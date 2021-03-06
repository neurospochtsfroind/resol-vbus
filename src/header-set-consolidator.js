/*! resol-vbus | Copyright (c) 2013-2014, Daniel Wippermann | MIT license */
'use strict';



var EventEmitter = require('events').EventEmitter;


var _ = require('lodash');


var HeaderSet = require('./header-set');



var optionKeys = [
    'interval',
    'timeToLive',
    'minTimestamp',
    'maxTimestamp',
];



var HeaderSetConsolidator = HeaderSet.extend({

    interval: 0,

    timeToLive: 0,

    minTimestamp: null,

    maxTimestamp: null,

    lastIntervalTime: 0,

    timer: null,

    constructor: function(options) {
        HeaderSet.call(this, options);

        _.extend(this, _.pick(options, optionKeys));
    },

    startTimer: function() {
        this.stopTimer();

        this.lastIntervalTime = Date.now();

        this._handleInterval();
    },

    stopTimer: function() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    },

    processHeaderSet: function(headerSet) {
        var _this = this;

        var now = headerSet.timestamp.getTime();

        this.addHeaders(headerSet.getHeaders());

        this._processHeaderSet(now);
    },

    _handleInterval: function() {
        var _this = this;

        var now = Date.now();

        this._processHeaderSet(now);

        var interval = 1000 - (now % 1000);
        this.timer = setTimeout(function() {
            _this._handleInterval();
        }, interval);
    },

    _processHeaderSet: function(now) {
        var include = true;

        if (this.minTimestamp) {
            if (now < this.minTimestamp) {
                include = false;
            }
        }

        if (this.maxTimestamp) {
            if (now > this.maxTimestamp) {
                include = false;
            }
        }

        if (this.interval > 0) {
            var lastInterval = Math.floor(this.lastIntervalTime / this.interval);
            var currentInterval = Math.floor(now / this.interval);
            var diff = currentInterval - lastInterval;

            if ((diff >= -1) && (diff <= 0)) {
                include = false;
            }
        }

        if (include) {
            if (this.timeToLive > 0) {
                this.removeHeadersOlderThan(now - this.timeToLive);
            }

            this.timestamp = new Date(now);

            this.emit('headerSet', this);

            this.lastIntervalTime = now;
        }
    },

});



module.exports = HeaderSetConsolidator;
