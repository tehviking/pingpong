/**
Copyright (c) 2010 Dennis Hotson

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

(function() {

jQuery.fn.springy = function(params) {
	var graph = params.graph;
	if(!graph){
			return;
	}

	var stiffness = params.stiffness || 400.0;
	var repulsion = params.repulsion || 2000.0;
	var damping = params.damping || 0.5;

	var canvas = this[0];
	var ctx = canvas.getContext("2d");
	var layout = new Layout.ForceDirected(graph, stiffness, repulsion, damping);

	var requestAnimFrame =
		window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function(callback, element) {
			window.setTimeout(callback, 10);
		};

	// calculate bounding box of graph layout.. with ease-in
	var currentBB = layout.getBoundingBox();
	var targetBB = {bottomleft: new Vector(-2, -2), topright: new Vector(2, 2)};

	// auto adjusting bounding box
	requestAnimFrame(function adjust(){
		targetBB = layout.getBoundingBox();
		// current gets 20% closer to target every iteration
		currentBB = {
			bottomleft: currentBB.bottomleft.add( targetBB.bottomleft.subtract(currentBB.bottomleft)
				.divide(10)),
			topright: currentBB.topright.add( targetBB.topright.subtract(currentBB.topright)
				.divide(10))
		};

		requestAnimFrame(adjust);
	});

	// convert to/from screen coordinates
	toScreen = function(p) {
		var size = currentBB.topright.subtract(currentBB.bottomleft);
		var sx = p.subtract(currentBB.bottomleft).divide(size.x).x * canvas.width;
		var sy = p.subtract(currentBB.bottomleft).divide(size.y).y * canvas.height;
		return new Vector(sx, sy);
	};

	fromScreen = function(s) {
		var size = currentBB.topright.subtract(currentBB.bottomleft);
		var px = (s.x / canvas.width) * size.x + currentBB.bottomleft.x;
		var py = (s.y / canvas.height) * size.y + currentBB.bottomleft.y;
		return new Vector(px, py);
	};

	// half-assed drag and drop
	var selected = null;
	var nearest = null;
	var dragged = null;

	jQuery(canvas).mousedown(function(e){
		jQuery('.actions').hide();

		var pos = jQuery(this).offset();
		var p = fromScreen({x: e.pageX - pos.left, y: e.pageY - pos.top});
		selected = nearest = dragged = layout.nearest(p);

		if (selected.node !== null)
		{
			dragged.point.m = 10000.0;
		}

		renderer.start();
	});
	
	jQuery(canvas).dblclick(function(e) {
	  var pos = jQuery(this).offset();
		var p = fromScreen({x: e.pageX - pos.left, y: e.pageY - pos.top});
		selected = nearest = layout.nearest(p);
		window.location = '/data_points/' + selected.node.data.data_point_id;
	});

	jQuery(canvas).mousemove(function(e){
		var pos = jQuery(this).offset();
		var p = fromScreen({x: e.pageX - pos.left, y: e.pageY - pos.top});
		nearest = layout.nearest(p);

		if (dragged !== null && dragged.node !== null)
		{
			dragged.point.p.x = p.x;
			dragged.point.p.y = p.y;
		}

		renderer.start();
	});
	jQuery(window).bind('mouseup',function(e){
		dragged = null;

// ========= Custom code starts here  ========= 
    
    // Populate the well with the details for the selected node
    $.get('/data_points/visualization_data/' + selected.node.data.data_point_id, function(data) {
      $('#data_point_details').html(data);
    });
    
    
// ========= End custom code ========= 
    
	}); 

	Node.prototype.getWidth = function() {
		var text = typeof(this.data.label) !== 'undefined' ? this.data.label : this.id;
		if (this._width && this._width[text])
			return this._width[text];

		ctx.save();
		ctx.font = "16px Arial, Verdana, sans-serif";
		var width = ctx.measureText(text).width + 17;
		ctx.restore();

		this._width || (this._width = {});
		this._width[text] = width;

		return width;
	};

	Node.prototype.getHeight = function() {
		return 20;
	};

	var renderer = new Renderer(1, layout,
		function clear()
		{
			ctx.clearRect(0,0,canvas.width,canvas.height);
		},
		function drawEdge(edge, p1, p2)
		{
			var x1 = toScreen(p1).x;
			var y1 = toScreen(p1).y;
			var x2 = toScreen(p2).x;
			var y2 = toScreen(p2).y;

			var direction = new Vector(x2-x1, y2-y1);
			var normal = direction.normal().normalise();

			var from = graph.getEdges(edge.source, edge.target);
			var to = graph.getEdges(edge.target, edge.source);

			var total = from.length + to.length;

			var n = 0;
			for (var i=0; i<from.length; i++)
			{
				if (from[i].id === edge.id)
				{
					n = i;
				}
			}

			var spacing = 10.0;

			// Figure out how far off centre the line should be drawn
			var offset = normal.multiply(-((total - 1) * spacing)/2.0 + (n * spacing));

			var s1 = toScreen(p1).add(offset);
			var s2 = toScreen(p2).add(offset);

			var boxWidth = edge.target.getWidth();
			var boxHeight = edge.target.getHeight();

			var intersection = intersect_line_box(s1, s2, {x: (x2-boxWidth/2.0), y: y2-boxHeight/2.0}, boxWidth - 25, boxHeight);

			if (!intersection) {
				intersection = s2;
			}


			var stroke = typeof(edge.data.color) !== 'undefined' ? edge.data.color : '#000000';
			var arrowWidth;
			var arrowLength;

			var weight = typeof(edge.data.weight) !== 'undefined' ? edge.data.weight : 1.6;

			ctx.lineWidth = Math.max(weight *  2, 0.1);
			arrowWidth = 3 + ctx.lineWidth;
			arrowLength = 15;

			var directional = typeof(edge.data.directional) !== 'undefined' ? edge.data.directional : true;

			// line
			var lineEnd;
			if (directional)
			{
				lineEnd = intersection.subtract(direction.normalise().multiply(arrowLength * 0.5));
			}
			else
			{
				lineEnd = s2;
			}

			ctx.strokeStyle = stroke;
  		ctx.beginPath();
			ctx.moveTo(s1.x, s1.y);
			ctx.lineTo(lineEnd.x, lineEnd.y);
			ctx.stroke();

			// arrow

			if (directional)
			{
				ctx.save();
				ctx.fillStyle = stroke;
				ctx.translate(intersection.x, intersection.y);
				ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
				ctx.beginPath();
				ctx.moveTo(-arrowLength, arrowWidth);
				ctx.lineTo(0, 0);
				ctx.lineTo(-arrowLength, -arrowWidth);
				ctx.lineTo(-arrowLength * 0.8, -0);
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			}
		},
		function drawNode(node, p)
		{
			var s = toScreen(p);

			ctx.save();

			var boxWidth = node.getWidth();
			var boxHeight = node.getHeight();

			// fill background
			ctx.clearRect(s.x - (boxWidth/2), s.y - (boxHeight/2), (boxWidth - (boxWidth/5)), 20);

			// fill background
			if (selected !== null && nearest.node !== null && selected.node.id === node.id) {
				ctx.fillStyle =  node.data.fillStyle != undefined ? node.data.fillStyle : "#63C3F9";
        		ctx.strokeStyle = "#000000";
			} else if (nearest !== null && nearest.node != null && nearest.node.id === node.id) {
				ctx.fillStyle = node.data.fillStyle != undefined ? node.data.fillStyle : "#CEE5FF";
	        	ctx.strokeStyle = node.data.strokeStyle !== 'undefined' ? node.data.strokeStyle : "#ACC5FF";
			} else {
				ctx.fillStyle = node.data.fillStyle != undefined ? node.data.fillStyle : '#EFEFEF';
        		ctx.strokeStyle = node.data.strokeStyle != undefined ? node.data.strokeStyle : '#D0D0D0';
			}

      // ctx.fillRect(s.x - (boxWidth/2), s.y - (boxHeight/2), (boxWidth - (boxWidth/5)), 20);
			
			var left = s.x - (boxWidth/2) + 5; // 20
			var top  = s.y - (boxHeight/2); // 10
			var right = left + (boxWidth - (boxWidth/5)) - 10; // 80
			var bottom = top + 20; // 20
			
			ctx.beginPath();
			ctx.moveTo(left, top); // 20, 10
			ctx.lineTo(right, top); // 80, 10
			ctx.quadraticCurveTo(right+5, top, right + 5, top + 5); // 90, 10, 90, 20
			ctx.lineTo(right + 5, bottom - 5); // 90, 80
			ctx.quadraticCurveTo(right + 5, bottom, right, bottom); // 90, 90, 80, 90
			ctx.lineTo(left, bottom); // 20, 90
			ctx.quadraticCurveTo(left-5, bottom, left - 5, bottom - 5); // 10, 90, 10, 80
			ctx.lineTo(left - 5, top + 5); // 10, 20
			ctx.quadraticCurveTo(left - 5, top, left, top); // 10, 10, 20, 10
			ctx.stroke();
			ctx.fill();

			ctx.textAlign = "left";
			ctx.textBaseline = "top";
			ctx.fillStyle = "#000000";
			ctx.font = "12px Verdana, sans-serif";
			var text = typeof(node.data.label) !== 'undefined' ? node.data.label : node.id;
			ctx.fillText(text, s.x - boxWidth/2 + 5, s.y - 8);

			ctx.restore();
		}
	);

	renderer.start();


	// helpers for figuring out where to draw arrows
	function intersect_line_line(p1, p2, p3, p4)
	{
		var denom = ((p4.y - p3.y)*(p2.x - p1.x) - (p4.x - p3.x)*(p2.y - p1.y));

		// lines are parallel
		if (denom === 0) {
			return false;
		}

		var ua = ((p4.x - p3.x)*(p1.y - p3.y) - (p4.y - p3.y)*(p1.x - p3.x)) / denom;
		var ub = ((p2.x - p1.x)*(p1.y - p3.y) - (p2.y - p1.y)*(p1.x - p3.x)) / denom;

		if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
			return false;
		}

		return new Vector(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
	}

	function intersect_line_box(p1, p2, p3, w, h)
	{
		var tl = {x: p3.x, y: p3.y};
		var tr = {x: p3.x + w, y: p3.y};
		var bl = {x: p3.x, y: p3.y + h};
		var br = {x: p3.x + w, y: p3.y + h};

		var result;
		if (result = intersect_line_line(p1, p2, tl, tr)) { return result; } // top
		if (result = intersect_line_line(p1, p2, tr, br)) { return result; } // right
		if (result = intersect_line_line(p1, p2, br, bl)) { return result; } // bottom
		if (result = intersect_line_line(p1, p2, bl, tl)) { return result; } // left

		return false;
	}
}

})();
