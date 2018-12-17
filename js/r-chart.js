function RChart(config) {
    var a = {
        state: { showPoint: true, showLine: true, showXGrid: false, showYGrid: true, showArea: true, changable: false },
        selected: [],
        isDown:false,
        selectRectangle: { x1: null, y1: null, x2: null, y2: null, template: null, element: null, active: false },
        update: function (obj) {
            for (var prop in obj) { this.state[prop] = obj[prop]; }
            this.updateData();
            this.updateAxis("x"); this.updateAxis("y");
            this.updatePosition();
            this.render();
            this.eventHandler("window", "keydown", this.keyDown);
            this.eventHandler("window", "keyup", this.keyUp);
        },
        updateData: function () {
            var s = this.state;
            var first = s.data[0].stream[0];
            s.xtype = typeof first.x; s.ytype = typeof first.y;
            s.xmin = first.x; s.ymin = first.y;
            s.xmax = first.x; s.ymax = first.y;
            s.barCount = 0;
            var types = [];
            for (var i = 0; i < s.data.length; i++) {
                var data = s.data[i];
                data.type = data.type || "line"; data.color = data.color || "#000"; data.pointSize = data.pointSize || 6; data.lineSize = data.lineSize || 1;
                if (types.indexOf(data.type) === -1) { types.push(data.type); }
                if (data.type === "bar") { s.barCount++; }
                var length = data.stream.length;
                for (var j = 0; j < length; j++) {
                    var stream = data.stream[j];
                    if (s.xtype !== typeof stream.x) { alert("error:multiple type in x of streams:data[" + i + "].stream[" + j + "].x"); }
                    if (s.ytype !== typeof stream.y) { alert("error:multiple type in y of streams:data[" + i + "].stream[" + j + "].y"); }
                    if (s.xtype === "number") { s.xmin = Math.min(s.xmin, stream.x); s.xmax = Math.max(s.xmax, stream.x); }
                    if (s.ytype === "number") { s.ymin = Math.min(s.ymin, stream.y); s.ymax = Math.max(s.ymax, stream.y); }
                }
            }
            s.type = types.length === 1 ? types[0] : "combo";
            s.rotated = s.xtype === "number" && s.ytype === "string";
        },
        updateAxis: function (axis) {
            var s = this.state, container = $(s.container);
            s[axis] = s[axis] || {};
            s.x.size = s.x.size || 36; s.y.size = s.y.size || 36;
            s[axis].labels = s[axis].labels || {};
            s.xsize = s.x.size; s.ysize = s.y.size;
            s.xsvg = $(s.container).width() - s.ysize; s.ysvg = $(s.container).height() - s.xsize;
            if (s[axis + 'type'] === "string") { if (!Array.isArray(s[axis].labels) || s[axis].labels.length === 0) { alert("error:" + axis + ".labels must be an array with greater length than 0!!!"); return false; } }
            else {
                if (typeof s[axis].labels !== "object" || Array.isArray(s[axis].labels)) { alert("error:x.labels must be an object!!!"); return false; }
                s[axis + 'start'] = s[axis].labels.start = s[axis].labels.start === undefined ? s[axis + 'min'] : s[axis].labels.start;
                s[axis + 'end'] = s[axis].labels.end = s[axis].labels.end === undefined ? s[axis + 'max'] : s[axis].labels.end;
                s[axis + 'step'] = s[axis].labels.step = s[axis].labels.step || Math.ceil((s[axis].labels.end - s[axis].labels.start) / 10);
                s[axis + 'startvalue'] = s[axis + 'start'] - (axis==="x"?(s[axis + 'step'] / 2):0);
                s[axis + 'endvalue'] = s[axis + 'end'] + (axis === "x" ? (s[axis + 'step'] / 2) : s[axis + 'step']);
                s[axis + 'ratio'] = s[axis + 'svg'] / (s[axis + 'endvalue'] - s[axis + 'startvalue']);
            }
            s[axis + 'labels'] = s[axis].labels;
            s[axis + 'list'] = getLabelList(s[axis].labels, axis);
            s[axis + 'length'] = s[axis + 'list'].length;
            s[axis + 'unit'] = s[axis + 'svg'] / s[axis + 'length'];
        },
        render: function () {
            var str = '', s = this.state;
            str += '<div class="r-chart" style="position:absolute;left:0;top:0;width:100%;height:100%;">';
            str += AxisX(s) + AxisY(s) + RSVG(s);
            str += '</div>';
            $(this.state.container).html(str);
            if (s.changable === true) {
                this.eventHandler(".r-c-point,.r-c-bar", "mousedown", this.pointMouseDown);
                this.eventHandler(".r-c-background", "mousedown", this.backgroundMouseDown);
            }
            this.eventHandler(".r-c-point", "mouseover", this.pointMouseOver);
            this.eventHandler(".r-c-point", "mouseleave", this.pointMouseOut);
        },
        updatePosition: function () {
            var datas = this.state.data, dataLength = datas.length;
            for (var i = 0; i < dataLength; i++) {
                var data = datas[i], streams = data.stream, streamLength = streams.length;
                for (var j = 0; j < streamLength; j++) {
                    var stream = streams[j];
                    stream.position = {
                        x: this.getXPosition(stream.x),
                        y: this.getYPosition(stream.y),
                    }
                }
            }
        },
        getXPosition: function (value) {
            var s = this.state;
            if (s.xtype === "string") {
                var index = s.xlist.indexOf(value);
                if (index === -1) { return false; }
                var position = index * s.xunit;
                position += s.xunit / 2;
            }
            else { var position = (value - s.xstartvalue) * s.xratio; }
            return position;
        },
        getYPosition: function (value) {
            var s = this.state;
            if (s.ytype === "string") {
                var index = s.ylist.indexOf(value);
                if (index === -1) { return false; }
                var position = index * s.yunit;
                position = s.ysvg - position;
            }
            else {
                var position = (value - s.ystartvalue) * s.yratio;
                position = s.ysvg - position;
            }
            return position;
        },
        updateElement: function (dataIndex, streamIndex, axis) {
            var s = this.state;
            var data = s.data[dataIndex];
            var stream = data.stream[streamIndex];
            var value = stream.position[axis];
            var container = $(s.container);
            if (data.type === "line") {
                var point = container.find(".r-c-point[data-data-index=" + dataIndex + "][data-stream-index=" + streamIndex + "]");
                point.attr("c" + axis, value);
                var beforeLine = container.find(".r-c-line[data-data-index=" + dataIndex + "][data-end-stream-index=" + streamIndex + "]");
                var afterLine = container.find(".r-c-line[data-data-index=" + dataIndex + "][data-start-stream-index=" + streamIndex + "]");
                beforeLine.attr(axis + "2", value);
                afterLine.attr(axis + "1", value);
                var path = container.find(".r-c-path[data-data-index=" + dataIndex + "]");
                path.attr("d", getD(data.stream, s));
            }
            else if (data.type === "bar") {
                var bar = container.find(".r-c-bar[data-data-index=" + dataIndex + "][data-stream-index=" + streamIndex + "]");
                if (axis === "x") {
                    bar.attr("width", value - s.xunit / 2);
                }
                else {
                    bar.attr(axis, value);
                    bar.attr("height", s.ysvg - value);
                }
            }
        },
        moveTo: function (dataIndex, streamIndex, value) {
            var s = this.state;
            var stream = s.data[dataIndex].stream[streamIndex];
            if (value.x !== undefined) {
                if (value.x > s.xend) { value.x = s.xend; }
                if (value.x < s.xstart) { value.x = s.xstart; }
                stream.x = value.x;
                stream.position.x = this.getXPosition(value.x);
                this.updateElement(dataIndex, streamIndex, "x");
            }
            if (value.y !== undefined) {
                if (value.y > s.yend) { value.y = s.yend; }
                if (value.y < s.ystart) { value.y = s.ystart; }
                stream.y = value.y;
                stream.position.y = this.getYPosition(value.y);
                this.updateElement(dataIndex, streamIndex, "y");
            }
        },
        select: function (obj) {
            var s = this.state;
            if (this.isSelected(obj)) { return; }
            var data = s.data[obj.dataIndex];
            var stream = data.stream[obj.streamIndex];
            var element = $(s.container).find("[data-data-index=" + obj.dataIndex + "][data-stream-index=" + obj.streamIndex + "]");
            var tagName = element.prop("tagName");
            this.selected.push({ dataIndex: obj.dataIndex, streamIndex: obj.streamIndex, position: stream.position });
            //pointerChart.addDetail(element);
            if (tagName === "circle") { element.attr("fill", data.color); }
            else if (tagName === "rect") {
                element.attr("fill", "#aaa");
            }
        },
        getIndex: function (obj) {
            if (obj.attr) { return { dataIndex: parseInt(obj.attr("data-data-index")), streamIndex: parseInt(obj.attr("data-stream-index")) }; }
            else { return { dataIndex: obj.dataIndex, streamIndex: obj.streamIndex }; }
        },
        isSelected: function (obj) {
            var index = this.getIndex(obj);
            for (var i = 0; i < this.selected.length; i++) {
                var s = this.selected[i];
                if (s.dataIndex !== index.dataIndex) { continue; }
                if (s.streamIndex !== index.streamIndex) { continue; }
                return true;
            }
            return false;
        },
        deselect: function (obj) {
            var s = this.state, index = this.getIndex(obj), data = s.data[index.dataIndex], stream = data.stream[index.streamIndex];
            var element = $(s.container).find("[data-data-index=" + index.dataIndex + "][data-stream-index=" + index.streamIndex + "]");
            var tagName = element.prop("tagName");
            if (tagName === "circle") { element.attr("fill", "#fff"); }
            if (tagName === "rect") { element.attr("fill", data.color); }
            //$(".stream-detail[data-data-index=" + index.data + "][data-stream-index=" + index.stream + "]").remove();
            var length = this.selected.length;
            for (var i = 0; i < length; i++) {
                var sel = this.selected[i];
                if (sel.dataIndex !== index.dataIndex) { continue; }
                if (sel.streamIndex !== index.streamIndex) { continue; }
                this.selected.splice(i, 1);
                break;
            }
        },
        deselectAll: function () {
            var length = this.selected.length;
            for (var i = 0; i < length; i++) {
                this.deselect(this.selected[0]);
            }
        },
        selectBySelectRectangle: function () {
            var s = this.state, sr = this.selectRectangle;
            if (!sr.active) { return; }
            var container = $(s.container);
            var startX = Math.min(sr.x1, sr.x2), endX = Math.max(sr.x1, sr.x2);
            var startY = Math.min(sr.y1, sr.y2), endY = Math.max(sr.y1, sr.y2);
            var points = container.find(".r-c-point");
            var length = points.length;
            for (var i = 0; i < length; i++) {
                var point = points.eq(i);
                var cx = parseFloat(point.attr("cx"));
                var cy = parseFloat(point.attr("cy"));
                if (cx > startX && cx < endX && cy > startY && cy < endY) {
                    this.select({ dataIndex: point.data("data-index"), streamIndex: point.data("stream-index") });
                }
            }
            var bars = container.find(".r-c-bar");
            var length = bars.length;
            for (var i = 0; i < length; i++) {
                var bar = bars.eq(i);
                var x = parseFloat(bar.attr("x"));
                var width = parseFloat(bar.attr("width"));
                var y = parseFloat(bar.attr("y"));
                var height = parseFloat(bar.attr("height"));
                if (x > endX) { continue; }
                if (x + width < startX) { continue; }
                if (y > endY) { continue; }
                this.select({ dataIndex: bar.data("data-index"), streamIndex: bar.data("stream-index") });
            }
            sr.element.attr({ "x": 0, "y": 0, "width": 0, "height": 0 });
            s.active = false;
        },
        getCoords: function (e) {
            var offset = $(this.state.container).find("svg").offset();
            return { x: e.clientX - offset.left + pageXOffset, y: e.clientY - offset.top + pageYOffset };
        },
        pointMouseOver: function (e) {
            if (this.isDown) { return;}
            this.addPointDetail($(e.currentTarget));
        },
        addPointDetail: function (point) {
            $(this.state.container).find(".r-chart-detail").remove();
            var data = this.state.data[point.attr("data-data-index")];
            var stream = data.stream[point.attr("data-stream-index")];
            var position = stream.position;
            var offset = data.pointSize / 2;
            $(this.state.container).append(RPointDetail({
                cx: parseInt(point.attr("cx")), cy: parseInt(point.attr("cy")),
                xsize: this.state.xsize, ysize: this.state.ysize,
                pointSize: data.pointSize,
                x: stream.x, y: stream.y
            }));
        },

        pointMouseOut: function () {
            if (this.isDown) { return;}
            $(this.state.container).find(".r-chart-detail").remove();
        },
        pointMouseDown: function (e) {
            this.isDown = $(e.currentTarget);
            var s = this.state;
            if (s.ytype === "number") { var axis = "y"; } else if (s.xtype === "number") { var axis = "x"; } else { return; }
            var element = $(e.target);
            var index = this.getIndex(element);
            if (!this.multiSelect) { if (!this.isSelected(element)) { this.deselectAll(); } }
            this.select(index);
            this.eventHandler("window", "mousemove", this.pointMouseMove);
            this.eventHandler("window", "mouseup", this.pointMouseUp);
            var coords = this.getCoords(e);
            var values = [];
            for (var i = 0; i < this.selected.length; i++) {
                var selected = this.selected[i];
                var value = s.data[selected.dataIndex].stream[selected.streamIndex][axis];
                values.push(value);
            }
            this.startOffset = { coord: coords[axis], axis: axis, run: false, values: values };
        },
        pointMouseMove: function (e) {

            var s = this.state, so = this.startOffset, axis = so.axis, ratio = s[axis + "ratio"];
            var coords = this.getCoords(e);
            var offset = coords[axis] - so.coord;
            offset /= ratio;
            offset = Math.floor(offset);
            if (axis === "y") { offset *= -1; }
            var change = [];
            for (var i = 0; i < this.selected.length; i++) {
                var selected = this.selected[i];
                var value = {};
                value[axis] = so.values[i] + offset;
                var changeObj = { dataIndex: selected.dataIndex, streamIndex: selected.streamIndex, value: value };
                change.push(changeObj);
                this.moveTo(changeObj.dataIndex, changeObj.streamIndex, changeObj.value);
            }
            this.change = change;
            this.addPointDetail(this.isDown);
        },
        pointMouseUp: function () {
            this.isDown = false;
            this.eventRemover("window", "mousemove", this.pointMouseMove);
            this.eventRemover("window", "mouseup", this.pointMouseUp);
            if (this.onchange && this.change) { this.onchange(this.change); }
            this.change = null;
        },
        keyDown: function (e) {
            e = e.which || e.keyCode;
            if (e === 17) { this.multiSelect = true; }
        },
        keyUp: function (e) {
            e = e.which || e.keyCode;
            if (e === 17) {
                this.multiSelect = false;
            }
        },
        backgroundMouseDown: function (e) {
            this.eventHandler("window", "mousemove", this.backgroundMouseMove);
            this.eventHandler("window", "mouseup", this.backgroundMouseUp);
            if (!this.multiSelect) {
                this.deselectAll();
            }
            var coords = this.getCoords(e);
            this.selectRectangle = { x1: coords.x, y1: coords.y, element: $(this.state.container).find(".select-rectangle") };
        },
        backgroundMouseMove: function (e) {
            var coords = this.getCoords(e);
            var s = this.selectRectangle;
            s.x2 = coords.x; s.y2 = coords.y;
            s.element.attr({ "width": Math.abs(s.x1 - s.x2), "height": Math.abs(s.y1 - s.y2), "x": Math.min(s.x1, s.x2), "y": Math.min(s.y1, s.y2) });
            if (Math.abs(s.x1 - s.x2) < 5 && Math.abs(s.y1 - s.y2) < 5) { s.active = false; }
            else { s.active = true; }
        },
        backgroundMouseUp: function (e) {
            this.eventRemover("window", "mousemove", this.backgroundMouseMove);
            this.eventRemover("window", "mouseup", this.backgroundMouseUp);
            this.selectBySelectRectangle();
        },
        eventHandler: function (selector, ev, func) {
            if (selector === "window") { $(window).unbind(ev, $.proxy(func, this)).bind(ev, $.proxy(func, this)); }
            else { $(this.state.container).find(selector).unbind(ev, $.proxy(func, this)).bind(ev, $.proxy(func, this)); }
        },
        eventRemover: function (selector, ev, func) {
            if (selector === "window") { $(window).unbind(ev, $.proxy(func, this)); }
            else { $(this.state.container).find(selector).unbind(ev, $.proxy(func, this)); }
        },
    };
    a.update(config);
    return a;
}

function AxisX(props) {
    var unitPercent = 100 / props.xlength;
    function getStyle() {
        var str = '';
        str += 'position:absolute;bottom:0;';
        str += 'left:' + (props.ysize) + 'px;';
        str += 'width:calc(100% - ' + (props.ysize) + 'px);';
        str += 'height:' + props.xsize + 'px;';
        return str;
    }
    var str = '';
    str += '<div class="x-axis" style="' + getStyle() + '">';
    for (var i = 0; i < props.xlength; i++) {
        var value = props.xlist[i];
        str += LabelX({
            value: value,
            left: (i * unitPercent) + (unitPercent / 2),
            widthPX: props.xsvg / props.xlength,
            height: props.xsize,
        });
    }
    str += '</div>';
    return str;
}

function AxisY(props) {
    var unitPercent = 100 / props.ylength;
    function getStyle() {
        var borderWidth = 1;
        var str = '';
        str += 'position:absolute;left:0;';
        str += 'bottom:' + props.xsize + 'px;';
        str += 'height:calc(100% - ' + props.xsize + 'px);';
        str += 'width:' + props.ysize + 'px;';
        return str;
    }
    var str = '';
    str += '<div class="y-axis" style="' + getStyle() + '">';
    for (var i = 0; i < props.ylength; i++) {
        var value = props.ylist[i];
        str += LabelY({
            value: value,
            bottom: i * unitPercent,
            height: unitPercent,
            width: props.ysize,
        });
    }
    str += '</div>';
    return str;
}

function LabelX(props) {
    function getStyle() {
        var str = '';
        str += 'position:absolute;top:0;text-align:center;';
        //str += 'box-shadow:inset 0 0 1px 1px #000;';
        str += 'left:' + props.left + '%;';
        str += 'width:1px;';
        str += 'height:' + props.height + 'px;';
        return str;
    }
    var str = '';
    str += '<div class="x-label" style="' + getStyle() + '">';
    str += '<span style="line-height:' + props.height + 'px;width:' + props.widthPX + 'px;display:block;position:absolute;left:' + (props.widthPX / -2) + 'px;">';
    str += props.value;
    str += '</span>';
    str += '</div>';
    return str;
}

function LabelY(props) {
    function getStyle() {
        var str = '';
        str += 'position:absolute;left:0;text-align:center;';
        //str += 'box-shadow:inset 0 0 1px 1px #000;';
        str += 'bottom:' + props.bottom + '%;';
        str += 'height:1px;';
        str += 'line-height:1px;';
        str += 'width:' + props.width + 'px;';
        return str;
    }
    var str = '';
    str += '<div class="y-label" style="' + getStyle() + '">';
    str += '<span style="padding:0 6px;">';
    str += props.value;
    str += '</span>';
    str += '</div>';
    return str;
}

function RSVG(props) {//x.size y.size x.svgsize y.svgsize data
    function getStyle() {
        var str = '';
        str += 'position:absolute;right:0;top:0;';
        //str += 'box-shadow:inset 0 0 1px 1px #000;';
        str += 'height:calc(100% - ' + props.xsize + 'px);';
        str += 'width:calc(100% - ' + props.ysize + 'px);';
        return str;
    }
    var str = '';
    str += '<svg width="100%" height="100%" class="r-chart-svg" style="' + getStyle() + '">';
    str += RGridlines(props);
    str += RBackground(props);
    str += RShadow();
    str += BarChart(props);
    str += LineChart(props);
    str += SelectRectangle();
    str += '</svg>';
    return str;
}

function RGridlines(props) {
    var str = '';
    for (var i = 0; i < props.xlength; i++) {
        str += RGridline({
            left: ((i * props.xunit) + (props.xunit / 2)).toFixed(0),
            height: props.ysvg,
            className: "x-gridline"
        });
    }
    for (var i = 0; i < props.ylength; i++) {
        str += RGridline({
            top: (i * props.yunit).toFixed(0),
            width: props.xsvg,
            className: "y-gridline"
        });
    }
    return str;
}

function RGridline(props) {
    var x1 = props.left || 0;
    var y1 = props.top || 0;
    var x2 = props.left || props.width;
    var y2 = props.height || props.top;
    return '<line class="' + props.className + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>';
}

function LineChart(props) {
    var str = '';
    if (props.type === "line") { str += RPathes(props); }
    str += RLines({ data: props.data });
    str += RPoints({ data: props.data });
    return str;
}

function BarChart(props) {
    var str = '';
    str += RBars(props);
    return str;
}

function RBars(props) {
    var datas = props.data;
    var barCounter = 0;
    var str = '';
    for (var i = 0; i < datas.length; i++) {
        var data = datas[i];
        if (data.type !== "bar") { continue; }
        var stream = data.stream;
        for (var j = 0; j < stream.length; j++) {
            var point = stream[j];
            if (!point.position) { continue; }
            str += RBar({
                dataIndex: i,
                streamIndex: j,
                x: point.position.x,
                y: point.position.y,
                color: data.color,
                barCounter: barCounter,
                state: props,
            });

        }
        barCounter++;
    }
    return str;
}

function RBar(props) {
    var s = props.state;
    var str = '';
    str += '<rect ';
    str += 'class="r-c-bar"';
    str += 'data-data-index="' + props.dataIndex + '" ';
    str += 'data-stream-index="' + props.streamIndex + '" ';
    if (!s.rotated) {
        var barWidth = s.xunit / 7 * 5;
        str += 'x="' + (props.x - barWidth / 2 + (props.barCounter * barWidth / s.barCount)) + '" ';
        str += 'y="' + props.y + '" ';
        str += 'width="' + (barWidth / s.barCount) + '" ';
        str += 'height="' + (s.ysvg - props.y) + '"';
    }
    else {
        var barWidth = s.yunit / 7 * 5;
        str += 'y="' + (props.y - barWidth / 2 + (props.barCounter * barWidth / s.barCount)) + '" ';
        str += 'x="' + (s.xunit / 2) + '" ';
        str += 'height="' + (barWidth / s.barCount) + '" ';
        str += 'width="' + (props.x - s.xunit / 2) + '"';
    }
    str += 'fill="' + props.color + '" ';
    str += 'filter="url(#f1)"';
    str += '/>';
    return str;
}

function RPathes(props) {
    var str = '';
    for (var i = 0; i < props.data.length; i++) {
        if (props.data[i].type !== "line") { continue; }
        str += RPath({
            dataIndex: i,
            state: props
        });
    }
    return str;
}

function RPath(props) {
    var s = props.state;
    var data = s.data[props.dataIndex];
    var str = '';
    str += '<path ';
    str += 'class="r-c-path" ';
    str += 'data-data-index="' + props.dataIndex + '" ';
    str += 'd="' + getD(data.stream, s) + '" ';
    str += 'fill="' + data.color + '" ';
    str += 'style="opacity:0.15;"';
    str += '/>';
    return str;
}

function RPoints(props) {
    var datas = props.data, dataLength = datas.length;
    var str = '';
    for (var i = 0; i < dataLength; i++) {
        var data = datas[i], streams = data.stream, streamLength = streams.length;
        if (data.type !== "line") { continue; }
        for (var j = 0; j < streamLength; j++) {
            var stream = streams[j];
            str += RPoint({
                dataIndex: i, streamIndex: j,
                x: stream.position.x, y: stream.position.y,
                pointWidth: data.pointSize,
                lineWidth: data.lineSize,
                color: data.color,
            });
        }
    }
    return str;
}

function RPoint(props) {
    var str = '';
    str += '<circle class="r-c-point" ';
    str += 'data-data-index="' + props.dataIndex + '" ';
    str += 'data-stream-index="' + props.streamIndex + '" ';
    str += 'cx="' + props.x + '" ';
    str += 'cy="' + props.y + '" ';
    str += 'r="' + (props.pointWidth / 2) + '" ';
    str += 'stroke="' + props.color + '" ';
    str += 'stroke-width="' + props.lineWidth + '" ';
    str += 'fill="#fff" ';
    str += '/>';
    return str;
}

function RLines(props) {
    var datas = props.data, dataLength = datas.length;
    var str = '';
    for (var i = 0; i < dataLength; i++) {
        var data = datas[i], streams = data.stream, streamLength = streams.length;
        if (data.type !== "line") { continue; }
        for (var j = 0; j < streamLength; j++) {
            var stream = streams[j], after = streams[j + 1];
            if (!after) { continue; }
            str += RLine({
                start: {
                    x: stream.position.x,
                    y: stream.position.y,
                    index: j
                },
                end: {
                    x: after.position.x,
                    y: after.position.y,
                    index: j + 1
                },
                dataIndex: i,
                lineWidth: data.lineSize,
                color: data.color,
            });
        }
    }
    return str;
}

function RLine(props) {
    var str = '';
    str += '<line class="r-c-line" ';
    if (props.dasharray) { str += 'stroke-dasharray="5,5" '; }
    str += 'x1="' + props.start.x + '" ';
    str += 'y1="' + props.start.y + '" ';
    str += 'x2="' + props.end.x + '" ';
    str += 'y2="' + props.end.y + '" ';
    str += 'data-data-index="' + props.dataIndex + '" ';
    str += 'data-start-stream-index="' + props.start.index + '" ';
    str += 'data-end-stream-index="' + props.end.index + '" ';
    str += 'style="stroke:' + props.color + ';stroke-width:' + props.lineWidth + ';" ';
    str += '/>';
    return str;
}

function getLabelList(labels, axis) {
    var list = [];
    if (Array.isArray(labels)) { list = labels; }
    else {
        var length = Math.ceil((labels.end - labels.start) / labels.step) + 1;
        for (var i = 0; i < length; i++) {
            list.push(labels.start + (i * labels.step));
        }
    }
    return list;
}

function getD(stream, s) {
    var path = '';
    var length = stream.length;
    if (s.rotated) { path += "M" + (s.xunit / 2) + " " + stream[0].position.y + " "; }
    else { path += "M" + stream[0].position.x + " " + s.ysvg + " "; }
    for (var j = 0; j < length; j++) {
        var position = stream[j].position;
        if (!position) { continue; }
        path += "L" + position.x + " " + position.y + " ";
    }
    if (s.rotated) { path += (s.xunit / 2) + " " + stream[length - 1].position.y + " "; }
    else { path += stream[length - 1].position.x + " " + s.ysvg + " "; }
    path += "Z";
    return path;
}

function RShadow() {
    var str = '';
    str += '<defs>';
    str += '<filter id="f1" x="0" y="0" width="200%" height="200%">';
    str += '<feOffset result="offOut" in="SourceAlpha" dx="0" dy="0" />';
    str += '<feGaussianBlur result="blurOut" in="offOut" stdDeviation="5" />';
    str += '<feBlend in="SourceGraphic" in2="blurOut" mode="normal" />';
    str += '</filter>';
    str += '</defs>';
    return str;
}

function RBackground(props) {
    var str = '';
    str += '<rect ';
    str += 'x="0" ';
    str += 'y="0" ';
    str += 'width="' + props.xsvg + '" ';
    str += 'height="' + props.ysvg + '" ';
    str += 'class="r-c-background" ';
    str += 'fill="#fff" ';
    str += 'style="opacity:0;" ';
    str += '/>'
    return str;
}

function SelectRectangle() {
    var str = '';
    str += '<rect ';
    str += 'class="select-rectangle" ';
    str += 'x="0" ';
    str += 'y="0" ';
    str += 'width="0" ';
    str += 'height="0" ';
    str += 'fill="#aaa"; ';
    str += 'style="opacity:0.5" ';
    str += '/>'
    return str;
}

function RPointDetail(props) {
    function getStyle() {
        var str = 'height:10px;width:40px;font-size:10px;text-align:center;position:absolute;';
        str+= 'left:' + (props.cx + props.ysize - 20) + 'px;';
        str += 'top:' + (props.cy - (props.pointSize / 2) - 14) + 'px;';
        return str;
    }
    return '<div style="' + getStyle() + '" class="r-chart-detail">' + (props.x + ',' + props.y) + '</div>';
}
























function rChart(config) {
    var a = {
        ///////////////////variables///////////////////////////////

        label: [],
        data: [],
        selected: [],
        filter: { x: [], y: [] },

        layout: {},
        container: null,
        svg: null,
        background: "",
        barCount: 0,
        dataDetails: null,
        multiSelect: false,
        startOffset: null,
        onchange: null,

        /////////////////////updates/////////////////////////
        update: function () {
            this.analyzeData();
            this.validateLabelModel("x");
            this.validateLabelModel("y");
            this.updateLabelModel("x");
            this.updateLabelModel("y");
            this.updatePositions("x");
            this.updatePositions("y");
            this.updateLayout();
        },
        //no preriquisit



        updateLayout: function () {
            var str = '';
            str += this.AxisX();
            str += this.AxisY();
            str += this.SVG();
            str += this.Filter();
            this.container.html(str);
            this.svg = this.container.find("svg");
            this.eventHandler(".filter-clear", "mousedown", this.clearFilter);
            this.container.find(".x-axis")[0].addEventListener("wheel", $.proxy(this.labelWheel, this));
            this.container.find(".y-axis")[0].addEventListener("wheel", $.proxy(this.labelWheel, this));

            if (this.label.x.type === "number") {
                this.eventHandler(".x-label-item div", "click", this.labelClick);
                this.eventHandler(".x-axis", "mousedown", this.labelMouseDown);
            }
            else {
                this.eventHandler(".x-axis", "mousedown", this.axisMouseDownX);
            }
            if (this.label.y.type === "number") {
                this.eventHandler(".y-label-item div", "click", this.labelClick);
                this.eventHandler(".y-axis", "mousedown", this.labelMouseDown);
            }
            else {
                this.eventHandler(".y-axis", "mousedown", this.axisMouseDownY);
            }
        },




        updateLabel: function (axis, obj) {
            for (var prop in obj) {
                this.label[axis][prop] = obj[prop];
            }
            this.updateLabelModel(axis);
            this.updatePositions(axis);
            this.updateLayout();
        },

        getFilteredLabels: function (list, axis) {
            var filter = this.filter[axis];
            if (filter.length === 0) { return list; }
            return filter;
        },
        clearFilter: function () {
            this.filter["x"] = [];
            this.filter["y"] = [];
            this.update();
        },
        getStreams: function (streams) {
            var list = [];
            var length = streams.length;
            for (var i = 0; i < length; i++) {
                var stream = streams[i];
                if (stream.position === false) { continue; } // نقاطی که در راستای ایکس خارج از چارت هستند را نادیده بگیر 
                list.push(stream);
            }
            return list;
        },
        moveSelectedBy: function (axis, offset) {
            var selecteds = this.selected;
            var length = selecteds.length;
            var ratio = this.label[axis].ratio;
            for (var i = 0; i < length; i++) {
                var selected = selecteds[i], data = this.data[selected.data], stream = data.stream[selected.stream];
                this.movePointTo(selected.data, selected.stream, axis, stream[axis] + offset);
            }
            this.updatePaths();
        },
        updateByJSON: function (json) {
            for (var i = 0; i < json.length; i++) {
                var obj = json[i];
                this.movePointTo(obj);
            }
        },



        /////////////////////events//////////////////////////



        labelClick: function (e) {
            var element = $(e.target);
            this.showLabelPopup(element);
        },
        labelMouseDown: function (e) {
            $(window).unbind("mousemove", $.proxy(this.labelMouseMove, this)).bind("mousemove", $.proxy(this.labelMouseMove, this));
            $(window).unbind("mouseup", $.proxy(this.labelMouseUp, this)).bind("mouseup", $.proxy(this.labelMouseUp, this));
            var axis = $(e.target).data("axis");
            var coords = this.getCoords(e);
            this.startOffset = { coord: coords[axis], axis: axis, run: false, start: this.label[axis].start };

        },
        labelMouseMove: function (e) {
            var so = this.startOffset;
            var offset = Math.floor((so.coord - e["client" + (so.axis).toUpperCase()]) * ((so.axis === "y") ? -1 : 1) / this.label[so.axis].ratio);
            if (Math.abs(offset) < 8 && so.run === false) { return; }
            if (so.run === false) { so.coord = e["client" + (so.axis).toUpperCase()]; offset = 0; }
            so.run = true;
            this.label[so.axis].start = so.start + offset;
            this.label[so.axis].start = so.start + offset;
            this.updateLabelModel(so.axis);
            this.updateLayout();
            this.updatePositions(so.axis);
            this.updateChart();
            this.draw();

        },
        labelMouseUp: function () {
            $(window).unbind("mousemove", $.proxy(this.labelMouseMove, this));
            $(window).unbind("mouseup", $.proxy(this.labelMouseUp, this));

        },
        labelWheel: function (e) {
            var axis = $(e.target).attr("data-axis");
            var type = this.label[axis].type;
            if (type !== "number") { return; }
            var a = e.wheelDelta;
            var b = 120;
            if (a === undefined) { a = e.detail; b = -3; }
            if (a == b) {
                this.label[axis].step--;
                this.label[axis].step--;
            }
            else if (a == b * (-1)) {
                this.label[axis].step++;
                this.label[axis].step++;
            }
            this.updateLabelModel(axis);
            this.updateLayout();
            this.updatePositions(axis);
            this.updateChart();
            this.draw();
        },
        axisMouseDownX: function (e) {
            this.startOffset = e.clientX;
            $(window).unbind("mousemove", $.proxy(this.axisMouseMoveX, this)).bind("mousemove", $.proxy(this.axisMouseMoveX, this));
            $(window).unbind("mouseup", $.proxy(this.axisMouseUpX, this)).bind("mouseup", $.proxy(this.axisMouseUpX, this));
        },
        axisMouseMoveX: function (e) {
            var rectangle = this.container.find(".x-filter-rectangle");
            var startOffset = this.startOffset;
            var offset = startOffset - e.clientX;
            if (Math.abs(offset) < 5) { return; }
            var axis = rectangle.parent();
            var left = startOffset - axis.offset().left + pageXOffset - ((offset > 0) ? offset : 0);
            rectangle.css({ "width": Math.abs(offset), "left": left });
        },
        axisMouseUpX: function () {
            $(window).unbind("mousemove", $.proxy(this.axisMouseMove, this));
            $(window).unbind("mouseup", $.proxy(this.axisMouseUp, this));
            var rectangle = this.container.find(".x-filter-rectangle");
            var axis = rectangle.data("axis");
            var rectangleLeft = rectangle.offset().left;
            var start = rectangleLeft;
            var end = rectangleLeft + rectangle.width();
            var labels = this.container.find("." + axis + "-axis ." + axis + "-label-item");
            var length = labels.length;
            var list = [];
            for (var i = 0; i < length; i++) {
                var label = labels.eq(i);
                var centerOfLabel = label.offset().left + label.width() / 2;
                if (centerOfLabel > end || centerOfLabel < start) { continue; }
                list.push(label.find("div").html());
            }
            if (list.length === 0) {
                rectangle.css("width", "0");
                return;
            }
            else {
                this.filter[axis] = list;
            }
            this.update();
        },
        axisMouseDownY: function (e) {
            this.startOffset = e.clientY;
            $(window).unbind("mousemove", $.proxy(this.axisMouseMoveY, this)).bind("mousemove", $.proxy(this.axisMouseMoveY, this));
            $(window).unbind("mouseup", $.proxy(this.axisMouseUpY, this)).bind("mouseup", $.proxy(this.axisMouseUpY, this));
        },
        axisMouseMoveY: function (e) {
            var rectangle = this.container.find(".y-filter-rectangle");
            var startOffset = this.startOffset;
            var offset = startOffset - e.clientY;
            if (Math.abs(offset) < 5) { return; }
            var axis = rectangle.parent();
            var top = startOffset - axis.offset().top + pageYOffset - ((offset > 0) ? offset : 0);
            rectangle.css({ "height": Math.abs(offset), "top": top });
        },
        axisMouseUpY: function () {
            $(window).unbind("mousemove", $.proxy(this.axisMouseMoveY, this));
            $(window).unbind("mouseup", $.proxy(this.axisMouseUpY, this));
            var rectangle = this.container.find(".y-filter-rectangle");
            var axis = rectangle.data("axis");
            var rectangleTop = rectangle.offset().top;
            var start = rectangleTop;
            var end = rectangleTop + rectangle.height();
            var labels = this.container.find("." + axis + "-axis ." + axis + "-label-item");
            var length = labels.length;
            var list = [];
            for (var i = 0; i < length; i++) {
                var label = labels.eq(i);
                var centerOfLabel = label.offset().top + label.height() / 2;
                if (centerOfLabel > end || centerOfLabel < start) { continue; }
                list.push(label.find("div").html());
            }
            if (list.length === 0) {
                rectangle.css("height", "0");
                return;
            }
            else {
                this.filter[axis] = list;
            }
            this.update();
        },

        /////////////////////select//////////////////////////




        /////////////////////edit labels/////////////////////
        showLabelPopup: function (element) {
            var index = element.data("label-index");
            var axis = element.data("axis");
            var str = '';
            str += '<input data-label-index="' + index + '" data-axis="' + axis + '" value="' + element.html() + '" class="label-textbox" type="text" style="font-size:' + this.style.axisFontSize + 'px;outline:none;text-align:center;z-index:10;position:absolute;width:100%;height:100%;left:0;top:0;background:#fff;">';
            str += '<div data-label-index="' + index + '" data-axis="' + axis + '" class="label-backdrop" style="z-index:1;position:fixed;width:100%;height:100%;left:0;top:0;"></div>';
            str += '<div data-label-index="' + index + '" data-axis="' + axis + '" class="label-add" style="text-align:center;border-radius:100%;z-index:10;position:absolute;width:16px;height:16px;left:calc(100% + 10px);top:calc(50% - 5px);background:#fff;box-shadow:0px 1px 2px 0px #555;">';
            str += '<div data-label-index="' + index + '" data-axis="' + axis + '" class="mdi mdi-plus" style="color:#000;font-size:14px;line-height:16px;"></div>';
            str += '</div>';
            str += '<div data-label-index="' + index + '" data-axis="' + axis + '" class="label-remove" style="text-align:center;border-radius:100%;z-index:10;position:absolute;width:16px;height:16px;left:calc(100% + 30px);top:calc(50% - 5px);background:#fff;box-shadow:0px 1px 2px 0px #555;">';
            str += '<div data-label-index="' + index + '" data-axis="' + axis + '" class="mdi mdi-delete" style="color:#000;font-size:14px;line-height:16px;"></div>';
            str += '</div>';
            str += '<div data-label-index="' + index + '" data-axis="' + axis + '" class="label-reset" style="text-align:center;border-radius:100%;z-index:10;position:absolute;width:16px;height:16px;left:calc(100% + 50px);top:calc(50% - 5px);background:#fff;box-shadow:0px 1px 2px 0px #555;">';
            str += '<div data-label-index="' + index + '" data-axis="' + axis + '" class="mdi mdi-loop" style="color:#000;font-size:14px;line-height:16px;"></div>';
            str += '</div>';
            element.parent().append(str);
            var self = this;
            setTimeout(function () {
                $(".label-textbox").select();
                self.eventHandler(".label-backdrop", "mousedown", self.removeLabelPopup);
                self.eventHandler(".label-add", "mousedown", self.addLabel);
                self.eventHandler(".label-remove", "mousedown", self.removeLabel);
                self.eventHandler(".label-reset", "mousedown", self.resetLabel);

            }, 30);

        },
        removeLabelPopup: function (e) {
            var element = $(e.target);
            var index = element.data("label-index");
            var axis = element.data("axis");
            var value = parseFloat(this.container.find(".label-textbox").val());
            this.changeLabel(index, value, axis);
            $(".label-backdrop").remove();
            $(".label-textbox").remove();
            $(".label-remove").remove();
            $(".label-add").remove();
            $(".label-reset").remove();
        },
        changeLabel: function (index, value, axis) {
            var label = this.label[axis];
            var obj;
            if (index === 0) {
                obj = { start: value };
            }
            else if (index === label.list.length - 1) {
                var step = (value - label.start) / (label.count - 1);
                step = Math.round(step);
                obj = { end: value, step: step };
            }
            else {
                var step = value - label.list[index - 1];
                step = Math.round(step);
                obj = { end: value, step: step };
            }
            this.updateLabel(axis, obj);

        },
        addLabel: function (e) {
            var element = $(e.target), index = element.data("label-index"), axis = element.data("axis");
            var label = this.label[axis];
            var obj;
            if (index === 0) {
                var count = label.count + 1;
                var start = label.start - label.step;
                obj = { count: count, start: start };
            }
            else if (index === label.list.length - 1) {
                var count = label.count + 1;
                obj = { count: count };
            }
            else {
                var end = label.start + (label.step * (label.count - 1));
                var step = (end - label.start) / label.count;
                step = Math.round(step);
                var count = label.count + 1;
                obj = { count: count, step: step };
            }
            this.updateLabel(axis, obj);
        },
        removeLabel: function (e) {
            var element = $(e.target);
            var index = element.data("label-index");
            var axis = element.data("axis");
            var label = this.label[axis];
            var obj;
            if (index === 0) {
                var count = label.count - 1;
                var start = label.start + label.step;
                obj = { count: count, start: start };
            }
            else if (index === label.list.length - 1) {
                var count = label.count - 1;
                obj = { count: count };
            }
            else {
                var count = label.count - 1;
                var end = label.start + (label.step * count);
                var step = (end - label.start) / (count);
                step = Math.round(label.step);
                obj = { count: count, step: step };
            }
            this.updateLabel(axis, obj);
        },
        resetLabel: function (e) {
            var element = $(e.target);
            var index = element.data("label-index");
            var axis = element.data("axis");
            var value = this.label[axis].list[index];
            var textbox = this.container.find(".label-textbox[data-label-index=" + index + "]");
            textbox.val(value);
        },


        Filter: function () {
            if (this.filter.x.length === 0 && this.filter.y.length === 0) { return ""; }
            var style = this.style;
            var getFilterStyle = function () {
                var str = '';
                str += 'position:absolute;';
                str += 'left: ' + (style.yWidth + style.margin) + 'px;';
                str += 'top: ' + style.margin + 'px;';
                str += 'font-size:' + (style.axisFontSize + 1) + 'px;';
                return str;
            }
            return '<span class="mdi mdi-filter-remove filter-clear" style="' + getFilterStyle() + '"></span>';
        },
        FilterRectX: function () {
            var str = '';
            str += '<div ';
            str += 'class="x-filter-rectangle" ';
            str += 'data-axis="x"';
            str += 'style="Position:absolute;';
            str += 'height:100%;';
            str += 'width:0;';
            str += 'left:0;';
            str += 'background:' + this.style.filterRectangleColor + ';';
            str += 'opacity:0.2;';
            str += '"></div>';
            return str;
        },
        FilterRectY: function () {
            var str = '';
            str += '<div ';
            str += 'class="y-filter-rectangle" ';
            str += 'data-axis="y"';
            str += 'style="Position:absolute;';
            str += 'height:0;';
            str += 'width:100%;';
            str += 'top:0;';
            str += 'background:' + this.style.filterRectangleColor + ';';
            str += 'opacity:0.2;';
            str += '"></div>';
            return str;
        },









    }
    a.init(config);
    return a;
}

