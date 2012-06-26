jQuery Kontrol
=============

Small extensible jQuery library of new UI controls ; dial (was 'knob'), XY pad, bars control ...

- canvas based ; no png or jpg sprites.
- touch, mousewheel, keyboard events implemented.
- downward compatible ; overloads inputs.

http://anthonyterrien.com/kontrol/

Controls
-------

- Dial (was 'Knob') : $('#id').dial()
- XY                : $('#id').xy()
- Bars              : $('#id').bars()

Example
-------

    <input type="text" value="75" class="dial">

    <script>
    $(function() {
        $(".dial").dial();
    }
    </script>

Options
-------

Options are provided as attributes 'data-option':

    <input type="text" class="dial" data-min="-50" data-max="50">

... or in the plugin method call :

    $(".dial").dial({
                    'min':-50
                    ,'max':50
                    })

The following options are supported on controls :

Behaviors :
* min : min value || default=0.
* max : max value || default=100.
* stopper : stop at 0 & 100 on keydown/mousewheel || default=true.
* readOnly : disable input and events.

UI :
* cursor : display mode "cursor" | default=gauge.
* thickness : gauge thickness.
* width : dial width.
* displayInput : default=true | false=hide input.
* displayPrevious : default=false | true=displays the previous value with transparency.
* fgColor : foreground color.
* bgColor : background color.

Hooks
-------

    <script>
    $(".dial").dial({
                        'release' : function(v) { /* ... */ }
                    });
    </script>


* 'change' : executed on change

* 'cancel' : executed on cancel ([esc])

* 'release' : executed on release

* 'draw' : when draw the canvas


Example
-------

    <input type="text" value="75" class="dial">

    <script>
    $(".dial").dial({
                    'change':function(e){
                            console.log(e);
                        }
                    });
    </script>


Dynamically configure
-------

    <script>
    $('.dial').trigger('configure',{"fgColor":"#FF0000", "cursor":true})
    </script>

Make your own component
-------

$(function () {

    // Component logic
    kontrol.NewComponent = function () {
        kontrol.Object.call(this);

        this.draw = function () {
            // console.log(this);
        };
    };

    // jQuery plugin
    $.fn.newcomponent = function (opt) {
        return this.each(
            function () {
                var k = new kontrol.NewComponent(opt);
                k.options = opt;
                k.target = $(this);
                k.run();
            }
        ).parent();
    };

});


Supported browser
-------

Chrome
Safari
Firefox
IE 9.0