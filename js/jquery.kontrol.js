/**
 * jQuery Kontrol
 *
 * Small extensible jQuery library of new UI controls ;
 * dial (was jQuery Knob), XY pad, bars control.
 *
 * Version: 0.3.0 (26/06/2012)
 * Requires: jQuery v1.7+
 *
 * Copyright (c) 2012 Anthony Terrien
 * Under MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
 *
 * Thanks to vor, eskimoblood, spiffistan
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
    window.requestAnimFrame = (function () {
                              return  window.requestAnimationFrame       ||
                                      window.webkitRequestAnimationFrame ||
                                      window.mozRequestAnimationFrame    ||
                                      window.oRequestAnimationFrame      ||
                                      window.msRequestAnimationFrame     ||
                                      function (callback) {
                                            window.setTimeout(callback, 15);
                                      };
                            })();

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

        this.value = null;
        this.newValue = null;
        this.x = 0;
        this.y = 0;
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

            this.target.data('kontroled', true);

            this.extendsOptions();
            o = this.options = $.extend(
                {
                    // Config
                    'min' : this.target.data('min') || 0,
                    'max' : this.target.data('max') || 100,
                    'stopper' : true,
                    'readOnly' : this.target.data('readonly'),

                    // UI
                    'cursor' : (this.target.data('cursor') === true && 30)
                                || this.target.data('cursor')
                                || 0,
                    'thickness' : this.target.data('thickness') || 0.35,
                    'width' : this.target.data('width') || 200,
                    'height' : this.target.data('height') || 200,
                    'displayInput' : this.target.data('displayinput') == null || this.target.data('displayinput'),
                    'displayPrevious' : this.target.data('displayprevious'),
                    'fgColor' : this.target.data('fgcolor') || '#87CEEB',

                    // Hooks
                    'draw' : null, // function () {}
                    'change' : null, // function (value) {}
                    'cancel' : null, // function () {}
                    'release' : null // function (value) {}
                }, this.options
            );

            // Global init
            this.value = $.parseJSON(this.target.val());
            (!o.displayInput) && this.target.hide();

            this.canvas = $('<canvas width="' + o.width + 'px" height="' + o.height + 'px"></canvas>');
            this.target
                .wrap($('<div style="width:' + o.width + 'px;height:' + o.height + 'px;"></div>')) //display:inline;
                .before(this.canvas);
            this.context = this.canvas[0].getContext("2d");

            if (this.value instanceof Object) {
                this.newValue = {};
                this.copyObjectTo(this.value, this.newValue);
            } else {
                this.newValue = this.value;
            }

            this.target
                .bind("configure", cf)
                .bind(
                    'change'
                    , function (e) {
                            self.val(self.target.val());
                        }
                );

            this.target
                .parent()
                .bind("configure", cf);

            this._listen()
                ._configure()
                ._xyInit()
                .init();

            this.isInitialized = true;

            this._draw();

            return this;
        };

        this._frame = function (e) {
            var redraw = function () {
                    if (self.isPressed) {
                        self._draw(e);
                        window.requestAnimFrame(redraw);
                    }
                }
            self.isPressed = true;
            window.requestAnimFrame(redraw);
        };

        this._draw = function (e) {
            
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
            };

            this.touchesIndex = kontrol.Core.getTouchesIndex(e, this.touchesIndex);
            this.change(this._touchCapture(e).xy2val(this.dx,this.dy));
            this._frame(e);

            // Touch events listeners
            kontrol.Core.document
                .bind("touchmove.k", touchMove)
                .bind(
                    "touchend.k"
                    , function (e) {
                        kontrol.Core.document.unbind('touchmove.k touchend.k keyup.k');

                        self.isPressed = false;
                        self.target.val(self.newValue);

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
                            };
                                
            this.change(this.xy2val(e.pageX, e.pageY));
            this._frame(e);

            
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

                        self.isPressed = false;

                        kontrol.Core.document.unbind('mousemove.k mouseup.k keyup.k');

                        self.target.val(JSON.stringify(self.newValue));

                        if (
                            self.releaseHook
                            && (self.releaseHook(self.newValue) === false)
                        ) return;

                        self.val(self.newValue);
                    }
                );

            return this;
        };

        this._xyInit = function () {
            var offset = this.canvas.offset();
            this.x = offset.left;
            this.y = offset.top;
            return this;
        };

        this._listen = function () {
            
            var kval, to, m = 1, kv = {37:-1, 38:1, 39:1, 40:-1};
            
            if (!this.options.readOnly) {

                this.canvas
                    .bind(
                        "mousedown"
                        , function (e) {
                            e.preventDefault();
                            self._xyInit()._mouseDown(e);
                         }
                    )
                    .bind(
                        "touchstart"
                        , function (e) {
                            e.preventDefault();
                            self._xyInit()._touchStart(e);
                         }
                    );

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
                                    var v = parseInt(self.target.val()) + kv[kc] * m;
                                    
                                    self.options.stopper
                                    && (v = Math.max(Math.min(v, self.options.max), self.options.min))

                                    self._frame(e);
                                    self.change(v);

                                    // long time keydown speed-up
                                    to = window.setTimeout(
                                                            function () { m < 20 && m++; }
                                                            ,30
                                                          );

                                    e.preventDefault();
                                }
                            }
                        }
                    )
                    .bind(
                        "keyup"
                        ,function (e) {
                            if (isNaN(kval)) {
                                self.isPressed = false;
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

            this.options.displayInput
                && this.target.css({
                        'width' : (this.options.width / 2 + 4) + 'px'
                        ,'position' : 'absolute'
                        ,'margin-top' : (this.options.width * 5 / 14) + 'px'
                        ,'margin-left' : '-' + (this.options.width * 3 / 4 + 2) + 'px'
                        ,'border' : 'none'
                        ,'background' : 'none'
                        ,'font' : 'bold ' + (this.options.width / 4) + 'px Arial'
                        ,'text-align' : 'center'
                        ,'color' : this.options.fgColor
                        ,'padding' : '0px'
                        ,'-webkit-appearance': 'none'
                        })
                || this.target.css({
                        'width' : '0px'
                        ,'visibility' : 'hidden'
                        });

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

        this.getColorRGBA = function (hexstr, opacity) {
            var h = hexstr.substring(1,7)
                ,rgb = [parseInt(h.substring(0,2),16)
                       ,parseInt(h.substring(2,4),16)
                       ,parseInt(h.substring(4,6),16)];
            return "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+opacity+")";
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
        this.lineWidth = null;
        this.cur3 = null;
        this.w2 = null;
        this.PI2 = 2*Math.PI;

        this.extendsOptions = function () {
            this.options = $.extend(
                {
                    'bgColor' : this.target.data('bgcolor') || '#EEEEEE',
                    'angleOffset': this.target.data('angleoffset') || 0
                }, this.options
            );
        };

        this.val = function (v) {
            if (null != v) {
                this.options.stopper
                    && (this.newValue = Math.max(Math.min(v, this.options.max), this.options.min))
                    || (this.newValue = v);
                
                this.value = this.newValue;
                this.target.val(this.value);
                this._draw();
            } else {
                return this.value;
            }
        };
        
        this.xy2val = function (x, y) {
            var b, a;
            b = a = Math.atan2(
                        x - (this.x + this.w2)
                        , - (y - this.y - this.w2)
                    ) - this.options.angleOffset;
            (a < 0) && (b = a + this.PI2);
            return Math.round(b * (this.options.max - this.options.min) / this.PI2) + this.options.min;
        };

        this.listen = function () {
            // bind MouseWheel
            var self = this
                , mw = function (e) {
                            e.preventDefault();
                            var ori = e.originalEvent
                                ,deltaX = ori.detail || ori.wheelDeltaX
                                ,deltaY = ori.detail || ori.wheelDeltaY
                                ,val = parseInt(self.target.val()) + (deltaX>0 || deltaY>0 ? 1 : deltaX<0 || deltaY<0 ? -1 : 0);
                            self.val(val);
                        };
            this.canvas.bind("mousewheel DOMMouseScroll", mw);
            this.target.bind("mousewheel DOMMouseScroll", mw)
        };

        this.init = function () {
            if (
                null === this.value
                || this.value < this.options.min
                || this.value > this.options.max
            ) this.value = this.options.min;
            this.target.val(this.value);
            this.w2 = this.options.width / 2;
            this.cur3 = this.options.cursor / 100;
            this.xy = this.w2;
            this.lineWidth = this.xy * this.options.thickness;
            this.radius = this.xy - this.lineWidth / 2;

            this.options.angleOffset
            // deg to rad
            && (this.options.angleOffset = isNaN(this.options.angleOffset) ? 0 : this.options.angleOffset * Math.PI / 180);

            this.startAngle = 1.5 * Math.PI + this.options.angleOffset;
        };

        this.change = function (v) {
            this.newValue = v;
            this.target.val(v);
        };

        this._angle = function (v) {
            return (v - this.options.min) * this.PI2 / (this.options.max - this.options.min);
        };

        this.draw = function () {

            var a = this._angle(this.newValue)  // Angle
                , sa = this.startAngle          // Previous start angle
                , sat = this.startAngle         // Start angle
                , ea                            // Previous end angle
                , eat = sat + a                 // End angle
                , r = true;
                ;

            this.clear();
            this.context.lineWidth = this.lineWidth;

            this.options.cursor
                && (sat = eat - this.cur3)
                && (eat = eat + this.cur3);

            this.context.beginPath();
            this.context.strokeStyle = this.options.bgColor;
            this.context.arc(this.xy, this.xy, this.radius, 0, this.PI2, true);
            this.context.stroke();

            if (this.options.displayPrevious) {
                ea = this.startAngle + this._angle(this.value);
                this.options.cursor
                    && (sa = ea - this.cur3)
                    && (ea = ea + this.cur3);

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
                    'min' : this.target.data('min') || 0,
                    'max' : this.target.data('max') || 100,
                    'displayValues' : true,
                    'displayInput' : false,
                    'width' : this.target.data('width') || 200,
                    'height' : this.target.data('height') || 200
                }, this.options
            );
        };

        this.init = function () {
            this.cursor = this.options.cursor || 30;
            this.cur2 = this.cursor / 2;
            this.xunit = (this.options.max - this.options.min) / (this.options.width - this.cursor);
            this.yunit = (this.options.max - this.options.min) / (this.options.height - this.cursor);

            if (!this.isInitialized) {
                this.mx = this.px = this.cur2 + (this.value.x - this.options.min) / this.xunit;
                this.my = this.py = this.options.height - (this.cur2 + (this.value.y - this.options.min) / this.yunit);
                this.div = $("<div style='margin:-20px 0px 0px 5px;font:11px Courier;'>0</div>");
                this.target.parent().append(this.div);
            }

            this.div.css({"color" : this.options.fgColor});
            //this.target.parent().css("background",this.options.bgColor);
        };

        this.xy2val = function (x, y) {
            this.mx = Math.max(this.cur2, Math.min(x - this.x, this.options.width - this.cur2));
            this.my = Math.max(this.cur2, Math.min(y - this.y, this.options.height - this.cur2));
            return {
                    x : Math.round(this.options.min + (this.mx - this.cur2) * this.xunit)
                    ,y : Math.round(this.options.min + (this.options.height - this.my - this.cur2) * this.yunit)
                    };
        };

        this.change = function (v) {
            this.newValue = v;
        };

        this.val = function (v) {
            if (null !== v) {
                this.newValue = v;
                this.copyObjectTo(this.newValue, this.value);
                this.target.val('{"x":'+this.value.x+',"y":'+this.value.y+'}');
                this.px = this.mx;
                this.py = this.my;
                this._draw();
            } else {
                return this.value;
            }
        };

        this.cancel = function () {
            this.copyObjectTo(this.value, this.newValue);
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
                r = (this.newValue.x == this.value.x && this.newValue.y == this.value.y);
            }
            
            c.beginPath();
            c.lineWidth = this.cursor;
            c.strokeStyle = r  ? this.options.fgColor : this.fgColor;
            c.moveTo(this.mx, this.my + this.cur2);
            c.lineTo(this.mx, this.my - this.cur2);
            c.stroke();

            this.options.displayValues
            && this.div.html('x:' + this.newValue.x +', y:' + this.newValue.y);

        };
    };

    $.fn.xy = function (gopt) {
        return this.each(
            function () {
                var k = new kontrol.XY();
                k.target = $(this);
                k.options = gopt;
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
        this.vals = {};

        this.extendsOptions = function () {
            this.options = $.extend(
                {
                    'min' : this.target.data('min') || 0,
                    'max' : this.target.data('max') || 100,
                    'displayValues' : true,
                    'displayInput' : false,
                    'width' : this.target.data('width') || 600,
                    'height' : this.target.data('height') || 200,
                    'fgColor' : this.target.data('fgcolor') || '#87CEEB',
                    'bgColor' : this.target.data('bgcolor') || '#CCCCCC',
                    'cols' : this.target.data('cols') || 8,
                    'spacing' : this.target.data('spacing') || 1
                }
                ,this.options
            );
        };

        this.xy2val = function (x, y) {
            var cw = this.colWidth + this.options.spacing
                ,col = Math.floor((x - this.x) / cw)
                ,val = Math.floor(
                            Math.max(this.options.min
                            , Math.min(this.options.max, - ( - this.mid + (y - this.y)) / this.bar))
                            )
                ,ret = {};

            ret[col] = val;
            return ret;
        };

        this.init = function () {
            (this.options.cols == 1) && (this.options.spacing = 0);
            this.colWidth = Math.floor((this.options.width - this.options.spacing * this.options.cols) / this.options.cols);
            this.bar = this.options.height / (this.options.max - this.options.min);
            this.mid = this.options.max * this.bar;
        };

        this.change = function (v) {
            for (var i in v) {
                if (i<0 || i>=this.options.cols) continue;
                this.newValue[i] = v[i];
                this.col = i;
            }
        };

        this.val = function (v) {
            if (null !== v) {
                if (v instanceof String) v = $.parseJSON(v);
                for (var i in v) this.newValue[i] = v[i];
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

            var o = this.options
                , x
                , c = this.context
                , r = (this.newValue[col] == this.value[col]);

            x = (col * (this.colWidth + o.spacing) + this.colWidth / 2);

            c.beginPath();
            c.lineWidth = this.colWidth;
            c.strokeStyle = this.options.bgColor;
            c.moveTo(x, this.mid);
            c.lineTo(x, this.mid + 1);
            c.stroke();

            if (this.options.displayPrevious) {
                c.beginPath();
                c.lineWidth = this.colWidth;
                c.strokeStyle = r ? o.fgColor : this.previousColor;
                if (this.options.cursor) c.lineTo(x, this.mid - this.value[col] * this.bar + this.options.cursor / 2);
                else c.moveTo(x, this.mid);
                c.lineTo(x, this.mid - this.value[col] * this.bar - this.options.cursor / 2);
                c.stroke();
            }

            c.beginPath();
            c.lineWidth = this.colWidth;
            c.strokeStyle = this.fgColor;
            if (this.options.cursor) c.lineTo(x, this.mid - this.newValue[col] * this.bar + this.options.cursor / 2);
            else c.moveTo(x, this.mid);
            c.lineTo(x, this.mid - this.newValue[col] * this.bar - this.options.cursor / 2);
            c.stroke();

            if (this.options.displayValues) {
                var fs = Math.max(Math.round(this.colWidth/3), 10);

                if (!this.vals[col]) {
                    this.vals[col] = $("<div style='float:left;font:bold " + fs + "px Arial;text-align:center;'>0</div>");
                    this.target.parent().append(this.vals[col]);
                }
                this.vals[col]
                    .css({
                            "opacity" : !r ? 1 : 0.6
                            ,"width" : this.colWidth+1
                            ,"font-size" : fs + "px"
                            ,"color" : this.fgColor
                        })
                    .html(this.newValue[col]);
            }
        };

        this.draw = function () {
            if (this.col) {
                // draw just one bar
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

    $.fn.bars = function (gopt) {
        return this.each(
            function () {
                var t = new kontrol.Bars();
                t.target = $(this);
                t.options = gopt;
                t.run();
            }
        ).parent();
    };
});