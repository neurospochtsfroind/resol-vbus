/*! resol-vbus | Copyright (c) 2013-2014, Daniel Wippermann | MIT license */
'use strict';



var _ = require('lodash');
var moreints = require('buffer-more-ints');


var Packet = require('./packet');
var HeaderSet = require('./header-set');

var Converter = require('./converter');



var optionKeys = [
];



var readUInt64LE = function(buffer, index) {
    return (buffer.readUInt32LE(index) + (buffer.readUInt32LE(index + 4) * 0x100000000));
};

var writeUInt64LE = function(buffer, index) {
    return (buffer.readUInt32LE(index) + (buffer.readUInt32LE(index + 4) * 0x100000000));
};


var VBusRecordingConverter = Converter.extend({

    rxBuffer: null,

    headerSet: null,

    headerSetTimestamp: null,

    currentChannel: 0,

    constructor: function(options) {
        var _this = this;

        Converter.call(this, options);

        _.extend(this, _.pick(options, optionKeys));

        this.on('finish', function() {
            _this._emitHeaderSet();

            _this.push(null);
        });
    },

    reset: function() {
        this.rxBuffer = null;
    },

    convertHeader: function(header) {
        return this._convertHeaders(header.timestamp, [ header ]);
    },

    convertHeaderSet: function(headerSet) {
        return this._convertHeaders(headerSet.timestamp, headerSet.getSortedHeaders());
    },

    _convertHeaders: function(timestamp, headers) {
        var buffers = [];

        var createBuffer = function(type, length, timestamp) {
            var buffer = new Buffer(length);
            buffer.fill(0);

            buffer [0] = 0xA5;
            buffer [1] = (type & 0x0F) | ((type & 0x0F) << 4);
            buffer.writeUInt16LE(length, 2);
            buffer.writeUInt16LE(length, 4);
            moreints.writeUInt64LE(buffer, timestamp.getTime(), 6);

            return buffer;
        };

        var buffer = createBuffer(4, 14, timestamp);
        buffers.push(buffer);

        var currentChannel = 0;

        _.forEach(headers, function(header) {
            var majorVersion = header.getProtocolVersion() >> 4;

            var dataLength;
            if (majorVersion === 1) {
                dataLength = header.frameCount * 4;
            } else {
                dataLength = -1;
            }

            if (dataLength >= 0) {
                var buffer;

                if (currentChannel !== header.channel) {
                    currentChannel = header.channel;

                    buffer = createBuffer(7, 16, new Date(0));
                    buffer.writeUInt16LE(header.channel, 14);
                    buffers.push(buffer);
                }

                buffer = createBuffer(6, 26 + dataLength, header.timestamp);

                buffer.writeUInt16LE(header.destinationAddress, 14);
                buffer.writeUInt16LE(header.sourceAddress, 16);
                buffer.writeUInt16LE(header.getProtocolVersion(), 18);

                if (majorVersion === 1) {
                    buffer.writeUInt16LE(header.command, 20);
                    buffer.writeUInt16LE(dataLength, 22);
                    buffer.writeUInt16LE(0, 24);

                    header.frameData.copy(buffer, 26, 0, dataLength);
                }

                buffers.push(buffer);
            }
        });

        buffer = Buffer.concat(buffers);
        return this.push(buffer);
    },

    _read: function() {
        // nop
    },

    _write: function(chunk, encoding, callback) {
        var buffer;
        if (this.rxBuffer) {
            buffer = Buffer.concat([ this.rxBuffer, chunk ]);
        } else {
            buffer = chunk;
        }

        var getRecordLength = function(index) {
            var length;
            if (index > buffer.length - 6) {
                length = 0;
            } else if (buffer [index] !== 0xA5) {
                length = 0;
            } else if ((buffer [index + 1] >> 4) !== (buffer [index + 1] & 15)) {
                length = 0;
            } else if (buffer [index + 2] !== buffer [index + 4]) {
                length = 0;
            } else if (buffer [index + 3] !== buffer [index + 5]) {
                length = 0;
            } else {
                length = buffer.readUInt16LE(index + 2);

                if ((index + length) > buffer.length) {
                    length = 0;
                }
            }
            return length;
        };

        var currentIndex = 0, currentLength = getRecordLength(0), nextIndex, nextLength, start = 0;
        while (currentIndex < buffer.length) {
            if (currentLength > 0) {
                nextIndex = currentIndex + currentLength;
            } else {
                nextIndex = currentIndex + 1;
            }

            nextLength = getRecordLength(nextIndex);

            if ((currentLength > 0) && ((nextLength > 0) || (nextIndex === buffer.length))) {
                var record = buffer.slice(currentIndex, nextIndex);

                this._processRecord(record);

                start = nextIndex;
            } else if (nextIndex !== (currentIndex + 1)) {
                nextIndex = currentIndex + 1;
                nextLength = getRecordLength(nextIndex);
            }

            currentIndex = nextIndex;
            currentLength = nextLength;
        }

        var maxLength = 65536;
        if (buffer.length - start >= maxLength) {
            start = buffer.length - maxLength;
        }

        if (start < buffer.length) {
            this.rxBuffer = new Buffer(buffer.slice(start));
        } else {
            this.rxBuffer = null;
        }

        callback();
    },

    _processRecord: function(buffer) {
        var type = buffer [1] & 0x0F;
        var timestamp = moreints.readUInt64LE(buffer, 6);

        if (type === 4) {
            this._emitHeaderSet();

            this.headerSet = new HeaderSet();

            this.headerSetTimestamp = new Date(timestamp);

            this.currentChannel = 0;
        } else if ((type === 6) && (buffer.length >= 20)) {
            var destinationAddress = buffer.readUInt16LE(14);
            var sourceAddress = buffer.readUInt16LE(16);
            var protocolVersion = buffer.readUInt16LE(18);

            var majorVersion = protocolVersion >> 4;
            if ((majorVersion === 1) && (buffer.length >= 26)) {
                var command = buffer.readUInt16LE(20);
                var dataLength = buffer.readUInt16LE(22);

                if (buffer.length >= 26 + dataLength) {
                    var frameCount = Math.floor(dataLength / 4);

                    var frameData = new Buffer(127 * 4);
                    buffer.copy(frameData, 0, 26, 26 + dataLength);

                    var header = new Packet({
                        timestamp: new Date(timestamp),
                        channel: this.currentChannel,
                        destinationAddress: destinationAddress,
                        sourceAddress: sourceAddress,
                        command: command,
                        frameCount: frameCount,
                        frameData: frameData,
                        dontCopyFrameData: true,
                    });

                    if (this.headerSet) {
                        this.headerSet.addHeader(header);
                    }

                    this.emit('header', header);
                }
            }
        } else if ((type === 7) && (buffer.length >= 16)) {
            this.currentChannel = buffer [14];
        }
    },

    _emitHeaderSet: function() {
        if (this.headerSet) {
            this.headerSet.timestamp = this.headerSetTimestamp;

            this.emit('headerSet', this.headerSet);

            this.headerSet = null;
        }
    }

});



module.exports = VBusRecordingConverter;
