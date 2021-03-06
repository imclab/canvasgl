/** namespace */
var CanvasGL	= CanvasGL	|| {};

//////////////////////////////////////////////////////////////////////////////////
//		Initialisation							//
//////////////////////////////////////////////////////////////////////////////////

CanvasGL.Context	= function(domElement, opts)
{
	opts			= opts || {};
	this._glFinishOnUpdate	= opts.glFinishOnUpdate	|| false; 
	this._domElement	= domElement;
	this._drawImages	= [];

	this._initGL();
	this._shaders	= new CanvasGL.Context.Shaders(this._gl);
	this._buffers	= new CanvasGL.Context.Buffers(this._gl);
}

CanvasGL.Context.prototype._initGL	= function()
{
	var gl;
	try {
		// get the context
		gl	= this._domElement.getContext("experimental-webgl");
//console.log("gl", gl);
//console.dir(this._domElement.getContext);
		// set the context dimensions
		gl.viewportWidth	= this._domElement.width;
		gl.viewportHeight	= this._domElement.height;
	}catch (e){}
	// check for errors
	if( !gl )	throw "Could not initialise WebGL, sorry :-(";

	this._gl	= gl;

	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	gl.enable(gl.DEPTH_TEST);
	// gl.LESS is much faster. less stressing on fragment shader i guess
	//gl.depthFunc( gl.LEQUAL );
	//gl.depthFunc( gl.LESS );

// TODO good stuff on init here
// https://github.com/mrdoob/three.js/blob/master/src/renderers/WebGLRenderer.js#L159

	if( false ){
		gl.enable( gl.BLEND );
		gl.blendEquationSeparate( gl.FUNC_ADD, gl.FUNC_ADD );
		gl.blendFuncSeparate( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA );		
		//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}

	// clear the screen
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);	// TODO do i need DEPTH ?
}

CanvasGL.Context.prototype.update	= function()
{
	this._render();
	this._drawImages	= new Array();	// reallocation ? any bench
}

CanvasGL.Context.prototype.drawImage	= function(imgElement)
{
	var dstX, dstY;
	var srcX = 0;
	var srcY = 0;
	var srcW = imgElement.width;
	var srcH = imgElement.height;
	var dstW = imgElement.width;
	var dstH = imgElement.height;
	if( arguments.length === 3 ){
		//ctx.drawImage(imgElement, dstX, dstY);
		dstX	= arguments[1];
		dstY	= arguments[2];
	}else if( arguments.length === 5 ){
		//ctx.drawImage(imgElement, dstX, dstY, dstW, dstH);
		dstX	= arguments[1];
		dstY	= arguments[2];
		dstW	= arguments[3];
		dstH	= arguments[4];
	}else if( arguments.length === 9 ){
		//ctx.drawImage(imgElement, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
		srcX	= arguments[1];
		srcY	= arguments[2];
		srcW	= arguments[3];
		srcH	= arguments[4];
		dstX	= arguments[5];
		dstY	= arguments[6];
		dstW	= arguments[7];
		dstH	= arguments[8];
	}else console.assert(false, "wrong number of parameters in .drawImage()");

	// queue this in the drawImages array
	this._drawImages.push({
		img	: imgElement,
		srcX	: srcX,
		srcY	: srcY,
		srcW	: srcW,
		srcH	: srcH,
		dstX	: dstX,
		dstY	: dstY,
		dstW	: dstW,
		dstH	: dstH
	});
}

//////////////////////////////////////////////////////////////////////////////////
//		Image								//
//////////////////////////////////////////////////////////////////////////////////

CanvasGL.Context.prototype._bindImage	= function(image)
{
	console.assert( !image._canvasglTexture );
	var gl		= this._gl;
	var texture	= gl.createTexture();
	image._canvasglTexture	= texture;
	var initTexture	= function(){
		//console.log("init texture for ", image)
		gl.bindTexture	(gl.TEXTURE_2D, texture);
		gl.texImage2D	(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.bindTexture	(gl.TEXTURE_2D, null);		
	};
	// image.width === 0 when it isnt yet loaded
	var isLoaded	= image.width ? true : false;
	if( isLoaded )	initTexture();
	else		image.onload	= function(){ initTexture(); }
}

CanvasGL.Context.prototype._unbindImage	= function(image)
{
	var gl		= this._gl;
	if( !image._canvasglTexture )	return;
	gl.deleteTexture(image._canvasglTexture);
	delete image._canvasglTexture;
}

CanvasGL.Context.prototype._isBoundImage	= function(image)
{
	return image._canvasglTexture ? true : false;
}

//////////////////////////////////////////////////////////////////////////////////
//		_render								//
//////////////////////////////////////////////////////////////////////////////////

CanvasGL.Context.prototype._render	= function()
{
	var gl		= this._gl;
	var drawImages	= this._drawImages;

	// detect batch using the same image as source
	for(var indexFirst = 0; indexFirst < drawImages.length;){
		var indexLast	= indexFirst;
		for(var i = indexFirst; i < drawImages.length; i++){
			if( drawImages[i].img !== drawImages[indexFirst].img )	break;
			indexLast	= i;
		}
		this._renderImage(drawImages, indexFirst, indexLast, true);
		indexFirst	= indexLast+1;
	}
}

CanvasGL.Context.prototype._renderImage	= function(drawImages, indexFirst, indexLast, bufferUpdate)
{
	var image	= drawImages[indexFirst].img;
	var program	= this._shaders.program();
	var gl		= this._gl;

	// build the buffer
	bufferUpdate && this._buffers.update(drawImages, indexFirst, indexLast);

	var buffer	= this._buffers.vertexPosition();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribPointer(program.vertexPositionAttribute, buffer.itemSize, gl.FLOAT, false, 0, 0);

	var buffer	= this._buffers.textureCoord();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribPointer(program.textureCoordAttribute, buffer.itemSize, gl.FLOAT, false, 0, 0);

	if( !image._canvasglTexture )	this._bindImage(image);
	var texture	= image._canvasglTexture;
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.uniform1i(program.samplerUniform, 0);

	// TODO this should be triangle strip ? trigrou says no
	// - so unclear at best. gl.TRIANGLES are simple. leave them for now
	// drawElements got limitations from a size pov
	var buffer	= this._buffers.vertexIndex();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
	gl.drawElements(gl.TRIANGLES, buffer.numItems, gl.UNSIGNED_SHORT, 0);

//this._unbindImage(image);
	// honor this._glFinishOnUpdate
	this._glFinishOnUpdate && gl.finish();
}
