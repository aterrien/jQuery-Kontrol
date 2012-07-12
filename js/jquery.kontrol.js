/**
 * jQuery Kontrol
 *
 * Small extensible jQuery library of new UI controls ;
 * Dial (was jQuery Knob), XY pad, Bars.
 *
 * Version: 0.7.0 (10/07/2012)
 * Requires: jQuery v1.7+
 *
 * Copyright (c) 2012 Anthony Terrien
 * Under MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
 *
 * Thanks to vor, eskimoblood, spiffistan, FabrizioC
 */
$(function () {

    /**
     * Kontrol library
     */
    "use strict";

    /**
     * Definition of globals and core
     */
    var kontrol = {};
    kontrol.Core = {};
    kontrol.Core.touchesIndex = 0;
    kontrol.Core.document = $(document);
    kontrol.Core.getTouchesIndex = function (e, assigned) {
        return e.originalEvent.touches.length - 1;
    };

    // requestAnimationFrame suport
    /*window.requestAnimFrame = (function () {
        return  window.requestAnimationFrame       ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                window.oRequestAnimationFrame      ||
                window.msRequestAnimationFrame     ||
                function (callback) {
                    window.setTimeout(callback, 1000/60); //60 FPS
                };
    })();*/

    /**
     * kontrol.Object
     *
     * Definition of an abstract UI control
     *
     * Each concrete component must call this one.
     * <code>
     * kontrol.Object.call(this);
     * </code>
     */
    kontrol.Object = function () {
        var self = this;

        this.target = null; // selected DOM Element
        this.input = null; // HTMLInputElement or array of HTMLInputElement
        this.value = null; // mixed array or integer
        this.newValue = null; // not commited value
        this.x = 0; // canvas x position
        this.y = 0; // canvas y position
        this.dx = 0;
        this.dy = 0;
        this.options = null;
        this.canvas = null;
        this.context = null;
        this.fgColor = null;
        this.previousColor = null;
        this.touchesIndex = 0;
        this.isInitialized = false;
        this.drawHook = null;
        this.changeHook = null;
        this.cancelHook = null;
        this.releaseHook = null;

        this.run = function () {
            var o, cf = function (e, conf) {
                var k;
                for (k in conf) {
                    self.options[k] = conf[k];
                }
                self.init();
                self._configure()
                    .draw();
            };

            if(this.target.data('kontroled')) return;
            this.target.data('kontroled', true);

            this.extendsOptions();
            o = this.options = $.extend(
                {
                    // Config
                    min : this.target.data('min') || 0,
                    max : this.target.data('max') || 100,
                    stopper : true,
                    readOnly : this.target.data('readonly'),

                    // UI
                    cursor : (this.target.data('cursor') === true && 30)
                                || this.target.data('cursor')
                                || 0,
                    thickness : this.target.data('thickness') || 0.35,
                    width : this.target.data('width') || 200,
                    height : this.target.data('height') || 200,
                    displayInput : this.target.data('displayinput') == null || this.target.data('displayinput'),
                    displayInputdisplayPrevious : this.target.data('displayprevious'),
                    fgColor : this.target.data('fgcolor') || '#87CEEB',
                    inline : false,

                    // Hooks
                    draw : null, // function () {}
                    change : null, // function (value) {}
                    cancel : null, // function () {}
                    release : null // function (value) {}
                }, this.options
            );

            // routing value
            if(this.target.is('fieldset')) {

                // fieldset = array of integer
                this.value = {};
                this.input = this.target.find('input')
                this.input.each(function(k) {
                    var $this = $(this);
                    self.input[k] = $this;
                    self.value[k] = $this.val();

                    $this.bind(
                        'change'
                        , function () {
                            var val = {};
                            val[k] = $this.val();
                            self.val(val);
                        }
                    );
                });
                this.target.find('legend').remove();

            } else {
                // input = integer
                this.input = this.target;
                this.value = this.target.val();
                (this.value == '') && (this.value = this.options.min);

                this.target.bind(
                    'change'
                    , function () {
                        self.val(self.target.val());
                    }
                );
            }

            (!o.displayInput) && this.target.hide();

            this.canvas = $('<canvas width="' + o.width + 'px" height="' + o.height + 'px"></canvas>');
            this.context = this.canvas[0].getContext("2d");
            
            this.target
                .wrap($('<div style="' + (o.inline ? 'display:inline;' : '') + 'width:' + o.width + 'px;height:' + o.height + 'px;"></div>'))
                .before(this.canvas);

            if (this.value instanceof Object) {
                this.newValue = {};
                this.copyObjectTo(this.value, this.newValue);
            } else {
                this.newValue = this.value;
            }

            this.target
                .bind("configure", cf)
                .parent()
                .bind("configure", cf);

            this._listen()
                ._configure()
                ._xy()
                .init();

            this.isInitialized = true;

            this._draw();

            return this;
        };

        /*this._frame = function () {
            var redraw = function () {
                if (self.isPressed) {
                    self._draw();
                    window.requestAnimFrame(redraw);
                }
            };
            self.isPressed = true;
            window.requestAnimFrame(redraw);
        };*/

        this._draw = function () {
            if (
                this.drawHook
                && (this.drawHook() === false)
            ) return;

            this.draw();
        };

        this._touchStart = function (e) {

            var touchMove = function (e) {
                var v = self._touchCapture(e).xy2val(self.dx, self.dy);
                if (v == this.newValue) return;

                if (
                    self.changeHook
                    && (self.changeHook(v) === false)
                ) return;

                self.change(v);
                self._draw();
            };

            this.touchesIndex = kontrol.Core.getTouchesIndex(e, this.touchesIndex);

            // First touch
            touchMove(e);

            // Touch events listeners
            kontrol.Core.document
                .bind("touchmove.k", touchMove)
                .bind(
                    "touchend.k"
                    , function (e) {
                        //self.isPressed = false;
                        kontrol.Core.document.unbind('touchmove.k touchend.k');

                        if (
                            self.releaseHook
                            && (self.releaseHook(self.newValue) === false)
                        ) return;

                        self.val(self.newValue);
                    }
                );

            return this;
        };

        this._mouseDown = function (e) {

            var mouseMove = function (e) {
                var v = self.xy2val(e.pageX, e.pageY);
                if (v == self.newValue) return;

                if (
                    self.changeHook
                    && (self.changeHook(v) === false)
                ) return;

                self.change(v);
                self._draw();
            };

            // First click
            mouseMove(e);

            // Mouse events listeners
            kontrol.Core.document
                .bind("mousemove.k", mouseMove)
                .bind(
                    // Escape key cancel current change
                    "keyup.k"
                    , function (e) {
                        if (e.keyCode === 27) {
                            kontrol.Core.document.unbind("mouseup.k mousemove.k keyup.k");

                            if (
                                self.cancelHook
                                && (self.cancelHook() === false)
                            ) return;

                            self.cancel();
                        }
                    }
                )
                .bind(
                    "mouseup.k"
                    , function (e) {
                        //self.isPressed = false;
                        kontrol.Core.document.unbind('mousemove.k mouseup.k keyup.k');

                        if (
                            self.releaseHook
                            && (self.releaseHook(self.newValue) === false)
                        ) return;

                        self.val(self.newValue);
                    }
                );

            return this;
        };

        this._xy = function () {
            var offset = this.canvas.offset();
            this.x = offset.left;
            this.y = offset.top;
            return this;
        };

        this._listen = function () {

            if (!this.options.readOnly) {

                this.canvas
                    .bind(
                        "mousedown"
                        , function (e) {
                            e.preventDefault();
                            self._xy()._mouseDown(e);
                         }
                    )
                    .bind(
                        "touchstart"
                        , function (e) {
                            e.preventDefault();
                            self._xy()._touchStart(e);
                         }
                    );

                this.listen();
            } else {
                this.target.attr('readonly', 'readonly');
            }

            return this;
        };

        this._configure = function () {

            // Hooks
            if (this.options.draw) this.drawHook = this.options.draw;
            if (this.options.change) this.changeHook = this.options.change;
            if (this.options.cancel) this.cancelHook = this.options.cancel;
            if (this.options.release) this.releaseHook = this.options.release;

            if (this.options.displayPrevious) {
                this.previousColor = this.getColorRGBA(this.options.fgColor,"0.4");
                this.fgColor = this.getColorRGBA(this.options.fgColor,"0.7");
            } else {
                this.fgColor = this.options.fgColor;
            }

            return this;
        };

        this._touchCapture = function (e) {
            this.dx = e.originalEvent.touches[this.touchesIndex].pageX;
            this.dy = e.originalEvent.touches[this.touchesIndex].pageY;
            return this;
        };

        this.clear = function () {
            this.context.clearRect(0, 0, this.options.width, this.options.height);
        };

        // Abstract methods
        this.listen = function () {}; // on start, one time
        this.extendsOptions = function () {}; // each time configure triggered
        this.init = function () {}; // each time configure triggered
        this.change = function (v) {}; // on change
        this.val = function (v) {}; // on release
        this.xy2val = function (x, y) {}; //
        this.draw = function () {}; // on change / on release

        // Utils
        this.getColorRGBA = function (hexstr, opacity) {
            var h = hexstr.substring(1,7)
                ,rgb = [parseInt(h.substring(0,2),16)
                       ,parseInt(h.substring(2,4),16)
                       ,parseInt(h.substring(4,6),16)];
            return "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+opacity+")";
        };

        this.copyObjectTo = function (f, t) {
            for (var i in f) { t[i] = f[i]; }
        };
    };


    /**
     * kontrol.Dial
     */
    kontrol.Dial = function () {
        kontrol.Object.call(this);

        this.startAngle = null;
        this.xy = null;
        this.radius = null;
        this.cursorExt = null;
        this.w2 = null;
        this.PI2 = 2*Math.PI;

        this.extendsOptions = function () {
            this.options = $.extend(
                {
                    bgColor : this.target.data('bgcolor') || '#EEEEEE',
                    angleOffset : this.target.data('angleoffset') || 0,
                    angleArc : this.target.data('anglearc') || 360,
                    inline : true
                }, this.options
            );
        };

        this.val = function (v) {
            if (null != v) {
                this.newValue = this.options.stopper ? Math.max(Math.min(v, this.options.max), this.options.min) : v;
                this.value = this.newValue;
                this.target.val(this.value);
                this._draw();
            } else {
                return this.value;
            }
        };

        this.xy2val = function (x, y) {
            var a, ret;

            a = Math.atan2(
                        x - (this.x + this.w2)
                        , - (y - this.y - this.w2)
                    ) - this.angleOffset;

            if(this.angleArc != this.PI2 && (a < 0) && (a > -.5)) {
                // if isset angleArc option, set to min if .5 under min
                a = 0;
            } else if (a < 0) {
                a += this.PI2;
            }

            ret = Math.round(a * (this.options.max - this.options.min) / this.angleArc)
                    + this.options.min;

            this.options.stopper
                && (ret = Math.max(Math.min(ret, this.options.max), this.options.min));

            return ret;
        };

        this.listen = function () {
            // bind MouseWheel
            var self = this
                , mw = function (e) {
                            e.preventDefault();
                            
                            var ori = e.originalEvent
                                ,deltaX = ori.detail || ori.wheelDeltaX
                                ,deltaY = ori.detail || ori.wheelDeltaY
                                ,v = parseInt(self.target.val()) + (deltaX>0 || deltaY>0 ? 1 : deltaX<0 || deltaY<0 ? -1 : 0);
                            
                            if (
                                self.changeHook
                                && (self.changeHook(v) === false)
                            ) return;

                            self.val(v);
                        }
                , kval, to, m = 1, kv = {37:-1, 38:1, 39:1, 40:-1};

            this.target
                .bind(
                    "keydown"
                    ,function (e) {
                        var kc = e.keyCode;
                        kval = parseInt(String.fromCharCode(kc));

                        if (isNaN(kval)) {

                            (kc !== 13)         // enter
                            && (kc !== 8)       // bs
                            && (kc !== 9)       // tab
                            && (kc !== 189)     // -
                            && e.preventDefault();

                            // arrows
                            if ($.inArray(kc,[37,38,39,40]) > -1) {
                                e.preventDefault();
                                
                                var v = parseInt(self.target.val()) + kv[kc] * m;

                                self.options.stopper
                                && (v = Math.max(Math.min(v, self.options.max), self.options.min));

                                self._draw();
                                //self._frame();
                                self.change(v);

                                // long time keydown speed-up
                                to = window.setTimeout(
                                    function () { m < 20 && m++; }
                                    ,30
                                );
                            }
                        }
                    }
                )
                .bind(
                    "keyup"
                    ,function (e) {
                        if (isNaN(kval)) {
                            //self.isPressed = false;
                            if (to) {
                                window.clearTimeout(to);
                                to = null;
                                m = 1;
                                self.val(self.target.val());
                            }
                        } else {
                            // kval postcond
                            (self.target.val() > self.options.max && self.target.val(self.options.max))
                            || (self.target.val() < self.options.min && self.target.val(self.options.min));
                        }

                    }
                );

            this.canvas.bind("mousewheel DOMMouseScroll", mw);
            this.target.bind("mousewheel DOMMouseScroll", mw)
        };

        this.init = function () {
            
            if (
                this.value < this.options.min
                || this.value > this.options.max
            ) this.value = this.options.min;
                
            this.target.val(this.value);
            this.w2 = this.options.width / 2;
            this.cursorExt = this.options.cursor / 100;
            this.xy = this.w2;
            this.context.lineWidth = this.xy * this.options.thickness;
            this.radius = this.xy - this.context.lineWidth / 2;

            this.options.angleOffset
            && (this.options.angleOffset = isNaN(this.options.angleOffset) ? 0 : this.options.angleOffset);

            this.options.angleArc
            && (this.options.angleArc = isNaN(this.options.angleArc) ? this.PI2 : this.options.angleArc);

            // deg to rad
            this.angleOffset = this.options.angleOffset * Math.PI / 180;
            this.angleArc = this.options.angleArc * Math.PI / 180;

            // compute start and end angles
            this.startAngle = 1.5 * Math.PI + this.angleOffset;
            this.endAngle = 1.5 * Math.PI + this.angleOffset + this.angleArc;

            var s = Math.max(
                            String(Math.abs(this.options.max)).length
                            , String(Math.abs(this.options.min)).length
                            , 2
                            ) + 2;

            this.options.displayInput
                && this.input.css({
                        'width' : Math.floor(this.options.width / 2 + 4) + 'px'
                        ,'height' : Math.floor(this.options.width / 3)
                        ,'position' : 'absolute'
                        ,'vertical-align' : 'middle'
                        ,'margin-top' : Math.floor(this.options.width / 3) + 'px'
                        ,'margin-left' : '-' + Math.floor(this.options.width * 3 / 4 + 2) + 'px'
                        ,'border' : 0
                        ,'background' : 'none'
                        ,'font' : 'bold ' + Math.floor(this.options.width / s) + 'px Arial'
                        ,'text-align' : 'center'
                        ,'color' : this.options.fgColor
                        ,'padding' : '0px'
                        ,'-webkit-appearance': 'none'
                        })
                || this.input.css({
                        'width' : '0px'
                        ,'visibility' : 'hidden'
                        });
        };

        this.change = function (v) {
            this.newValue = v;
            this.target.val(v);
        };

        this._angle = function (v) {
            return (v - this.options.min) * this.angleArc / (this.options.max - this.options.min);
        };

        this.draw = function () {

            var a = this._angle(this.newValue)  // Angle
                , sat = this.startAngle         // Start angle
                , eat = sat + a                 // End angle
                , sa, ea                        // Previous angles
                , r = true;

            this.clear();

            this.options.cursor
                && (sat = eat - this.cursorExt)
                && (eat = eat + this.cursorExt);

            this.context.beginPath();
            this.context.strokeStyle = this.options.bgColor;
            this.context.arc(this.xy, this.xy, this.radius, this.endAngle, this.startAngle, true);
            this.context.stroke();

            if (this.options.displayPrevious) {
                ea = this.startAngle + this._angle(this.value);
                sa = this.startAngle;
                this.options.cursor
                    && (sa = ea - this.cursorExt)
                    && (ea = ea + this.cursorExt);

                this.context.beginPath();
                this.context.strokeStyle = this.previousColor;
                this.context.arc(this.xy, this.xy, this.radius, sa, ea, false);
                this.context.stroke();
                r = (this.newValue == this.value);
            }

            this.context.beginPath();
            this.context.strokeStyle = r ? this.options.fgColor : this.fgColor ;
            this.context.arc(this.xy, this.xy, this.radius, sat, eat, false);
            this.context.stroke();
        };

        this.cancel = function () {
            this.val(this.value);
        };
    };

    $.fn.knob = $.fn.dial = function (opt) {
        return this.each(
            function () {
                var k = new kontrol.Dial();
                k.options = opt;
                k.target = $(this);
                k.run();
            }
        ).parent();
    };


    /**
     * kontrol.XY
     */
    kontrol.XY = function () {
        kontrol.Object.call(this);

        this.mx = 0;
        this.my = 0;
        this.px = 0;
        this.py = 0;
        this.cur2 = 0;
        this.cursor = 0;
        this.value = {};
        this.div = null;

        this.extendsOptions = function () {
            this.options = $.extend(
                {
                    min : this.target.data('min') || 0,
                    max : this.target.data('max') || 100,
                    width : this.target.data('width') || 200,
                    height : this.target.data('height') || 200
                }, this.options
            );
        };

        this.init = function () {
            this.cursor = this.options.cursor || 30;
            this.cur2 = this.cursor / 2;
            this.xunit = (this.options.max - this.options.min) / (this.options.width - this.cursor);
            this.yunit = (this.options.max - this.options.min) / (this.options.height - this.cursor);

            if (!this.isInitialized) {
                this.mx = this.px = this.cur2 + (this.value[0] - this.options.min) / this.xunit;
                this.my = this.py = this.options.height - (this.cur2 + (this.value[1] - this.options.min) / this.yunit);
            }

            if(this.options.displayInput) {
                var self = this;

                this.target.css({
                        'margin-top' : '-30px'
                        , 'border' : 0
                        , 'font' : '11px Arial'
                        });

                this.input.each(
                    function (){
                        $(this).css({
                            'width' : (self.options.width / 4) + 'px'
                            ,'border' : 0
                            ,'background' : 'none'
                            ,'color' : self.options.fgColor
                            ,'padding' : '0px'
                            ,'-webkit-appearance': 'none'
                            });
                    });
            } else {
                this.target.css({
                        'width' : '0px'
                        ,'visibility' : 'hidden'
                        });
            }
        };

        this.xy2val = function (x, y) {
            this.mx = Math.max(this.cur2, Math.min(x - this.x, this.options.width - this.cur2));
            this.my = Math.max(this.cur2, Math.min(y - this.y, this.options.height - this.cur2));
            return [
                    Math.round(this.options.min + (this.mx - this.cur2) * this.xunit)
                    , Math.round(this.options.min + (this.options.height - this.my - this.cur2) * this.yunit)
                    ];
        };

        this.change = function (v) {
            this.newValue = v;
            this.input[0].val(this.newValue[0]);
            this.input[1].val(this.newValue[1]);
        };

        this.val = function (v) {
            if (null !== v) {
                this.newValue = v;
                this.copyObjectTo(this.newValue, this.value);
                this.px = this.mx;
                this.py = this.my;
                this._draw();
            } else {
                return this.value;
            }
        };

        this.cancel = function () {
            this.copyObjectTo(this.value, this.newValue);
            this.input[0].val(this.newValue[0]);
            this.input[1].val(this.newValue[1]);
            this.mx = this.px;
            this.my = this.py;
            this._draw();
        };

        this.draw = function () {

            var c = this.context
                , r = true;

            this.clear();

            if (this.options.displayPrevious) {
                c.beginPath();
                c.lineWidth = this.cursor;
                c.strokeStyle = this.previousColor;
                c.moveTo(this.px, this.py + this.cur2);
                c.lineTo(this.px, this.py - this.cur2);
                c.stroke();
                r = (this.newValue[0] == this.value[0] && this.newValue[1] == this.value[1]);
            }

            c.beginPath();
            c.lineWidth = this.cursor;
            c.strokeStyle = r  ? this.options.fgColor : this.fgColor;
            c.moveTo(this.mx, this.my + this.cur2);
            c.lineTo(this.mx, this.my - this.cur2);
            c.stroke();
        };
    };

    $.fn.xy = function (opt) {
        return this.each(
            function () {
                var k = new kontrol.XY();
                k.target = $(this);
                k.options = opt;
                k.run();
            }
        ).parent();
    };


    /**
     * kontrol.Bars
     */
    kontrol.Bars = function () {
        kontrol.Object.call(this);

        this.bar = null;
        this.mid = null;
        this.col = null;
        this.colWidth = null;
        this.fontSize = null;
        this.displayMidLine = false;

        this.extendsOptions = function () {

            this.options = $.extend(
                {
                    min : this.target.data('min') || 0,
                    max : this.target.data('max') || 100,
                    width : this.target.data('width') || 600,
                    displayInput : this.target.data('displayinput') == null || this.target.data('displayinput'),
                    height : (this.target.data('height') || 200),
                    fgColor : this.target.data('fgcolor') || '#87CEEB',
                    bgColor : this.target.data('bgcolor') || '#CCCCCC',
                    cols : this.target.data('cols') || 8,
                    spacing : this.target.data('spacing') || 1
                }
                ,this.options
            );

            // initialize colWith
            (this.options.cols == 1) && (this.options.spacing = 0);
            this.colWidth = Math.floor((this.options.width - this.options.spacing * this.options.cols) / this.options.cols);

            if(this.options.displayInput) {
                this.fontSize = Math.max(Math.round(this.colWidth/3), 10);
                this.options.height -= this.fontSize;
            }
        };

        this.xy2val = function (x, y) {
            var cw = this.colWidth + this.options.spacing
                ,val = Math.floor(
                            Math.max(this.options.min
                            , Math.min(this.options.max, - ( - this.mid + (y - this.y)) / this.bar))
                            )
                ,ret = {};

            this.col = Math.max(0, Math.min(this.options.cols-1, Math.floor((x - this.x) / cw)));
            ret[this.col] = val;
            return ret;
        };

        this.init = function () {

            this.bar = this.options.height / (this.options.max - this.options.min);
            this.mid = Math.floor(this.options.max * this.bar);
            this.displayMidLine = this.options.cursor && this.options.min < 0;

            if(this.options.displayInput) {
                var self = this;
                this.target.css({
                        'margin' : '0px'
                        ,'border' : 0
                        ,'padding' : '0px'
                        });

                this.input.each(
                    function (){
                        $(this).css({
                            'width' : (self.colWidth - 4 +  self.options.spacing) + 'px'
                            ,'border' : 0
                            ,'background' : 'none'
                            ,'font' : self.fontSize+'px Arial' //this.fontSize
                            ,'color' : self.options.fgColor
                            ,'margin' : '0px'
                            ,'padding' : '0px'
                            ,'-webkit-appearance': 'none'
                            ,'text-align' : 'center'
                            });
                    });
            } else {
                this.target.css({
                        'width' : '0px'
                        ,'visibility' : 'hidden'
                        });
            }
        };

        this.change = function (v) {
            for (var i in v) {
                this.newValue[i] = v[i];
                this.input[i].val(this.newValue[i]);
            }
        };

        this.val = function (v) {
            if (null !== v) {
                this.copyObjectTo(v, this.newValue);
                this.copyObjectTo(this.newValue, this.value);

                // reset cur col
                this.col = null;
                this._draw();
            } else {
                return this.value;
            }
        };

        this.cancel = function () {
            this.copyObjectTo(this.value, this.newValue);

            // reset cur col
            this.col = null;
            this._draw();
        };

        this._drawBar = function (col) {

            var x = (col * (this.colWidth + this.options.spacing) + this.colWidth / 2);

            if (this.displayMidLine) {
                this.context.beginPath();
                this.context.lineWidth = this.colWidth;
                this.context.strokeStyle = this.options.fgColor;
                this.context.moveTo(x, this.mid);
                this.context.lineTo(x, this.mid + 1);
                this.context.stroke();
            }

            if (this.options.displayPrevious) {
                this.context.beginPath();
                this.context.lineWidth = this.colWidth;
                this.context.strokeStyle = (this.newValue[col] == this.value[col]) ? this.options.fgColor : this.previousColor;
                if (this.options.cursor) {
                    this.context.lineTo(x, this.mid - Math.floor(this.value[col] * this.bar) + this.options.cursor / 2);
                } else {
                    this.context.moveTo(x, this.mid);
                }
                this.context.lineTo(x, this.mid - Math.floor(this.value[col] * this.bar) - this.options.cursor / 2);
                this.context.stroke();
            }

            this.context.beginPath();
            this.context.lineWidth = this.colWidth;
            this.context.strokeStyle = this.fgColor;
            if (this.options.cursor) {
                this.context.lineTo(x, this.mid - Math.floor(this.newValue[col] * this.bar) + this.options.cursor / 2);
            } else {
                this.context.moveTo(x, this.mid);
            }
            this.context.lineTo(x, this.mid - Math.floor(this.newValue[col] * this.bar) - this.options.cursor / 2);
            this.context.stroke();
        };

        this.draw = function () {
            if (this.col) {
                // current col
                this.context.clearRect(
                    this.col * (this.colWidth + this.options.spacing)
                    , 0
                    , this.colWidth + this.options.spacing
                    , this.options.height
                );
                this._drawBar(this.col);
            } else {
                // redraw all
                this.clear();
                for (var i = 0; i < this.options.cols; i++) {
                    this._drawBar(i);
                }
            }
        };
    };

    $.fn.bars = function (opt) {
        return this.each(
            function () {
                var t = new kontrol.Bars();
                t.target = $(this);
                t.options = opt;
                t.run();
            }
        ).parent();
    };
});