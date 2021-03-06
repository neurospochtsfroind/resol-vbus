/*! resol-vbus | Copyright (c) 2013-2014, Daniel Wippermann | MIT license */
'use strict';



var Converter = require('./resol-vbus').Converter;



describe('Converter', function() {

    describe('constructor', function() {

        it('should be a constructor function', function() {
            expect(Converter).to.be.a('function');

            var spec = new Converter();

            expect(spec).to.be.an.instanceOf(Converter);
        });

    });

    describe('#reset', function() {

        it('should be a method', function() {
            expect(Converter.prototype.reset).to.be.a('function');
        });

    });

    describe('#convertHeader', function() {

        it('should be a method', function() {
            expect(Converter.prototype.convertHeader).to.be.a('function');
        });

        it('should be abstract', function() {
            var converter = new Converter();

            expect(function() {
                converter.convertHeader();
            }).to.throw(Error, 'Must be implemented by sub-class');
        });

    });

    describe('#convertHeaderSet', function() {

        it('should be a method', function() {
            expect(Converter.prototype.convertHeaderSet).to.be.a('function');
        });

        it('should be abstract', function() {
            var converter = new Converter();

            expect(function() {
                converter.convertHeaderSet();
            }).to.throw(Error, 'Must be implemented by sub-class');
        });

    });

    describe('#_read', function() {

        it('should be a method', function() {
            expect(Converter.prototype._read).to.be.a('function');
        });

        it('should be abstract', function() {
            var converter = new Converter();

            expect(function() {
                converter._read();
            }).to.throw(Error, 'Must be implemented by sub-class');
        });

    });

    describe('#_write', function() {

        it('should be a method', function() {
            expect(Converter.prototype._write).to.be.a('function');
        });

        it('should be abstract', function() {
            var converter = new Converter();

            expect(function() {
                converter._write();
            }).to.throw(Error, 'Must be implemented by sub-class');
        });

    });

});
