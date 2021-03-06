// Effect Games Engine v1.0
// Copyright (c) 2005 - 2011 Joseph Huckaby
// Source Code released under the MIT License: 
// http://www.opensource.org/licenses/mit-license.php

////
// Sprite.js
// Base class for all game objects
////

function Sprite() {
	// class constructor
};

Sprite.prototype.__name = 'Sprite';
Sprite.extend = function(_name, _members) { Class.extend(this, _name, _members); };
Sprite.subclass = Sprite.extend;

Sprite.prototype._isSprite = true;
Sprite.prototype.x = 0;
Sprite.prototype.y = 0;
Sprite.prototype.xd = 0;
Sprite.prototype.yd = 0;
Sprite.prototype.width = 0;
Sprite.prototype.height = 0;
Sprite.prototype.frameX = 0;
Sprite.prototype.frameY = 0;
Sprite.prototype.zIndex = 1;
Sprite.prototype.opacity = 1.0;
Sprite.prototype.url = '';
Sprite.prototype.div = null;
Sprite.prototype.visible = true;
Sprite.prototype.offsetX = 0;
Sprite.prototype.offsetY = 0;
Sprite.prototype.clipX = 0;
Sprite.prototype.clipY = 0;

Sprite.prototype._oldFrameX = 0;
Sprite.prototype._oldFrameY = 0;
Sprite.prototype._oldScreenX = -99999;
Sprite.prototype._oldScreenY = -99999;

Sprite.prototype.solid = false;
Sprite.prototype.ground = false;
Sprite.prototype.collisions = false;

Sprite.prototype.dieOffscreen = false;
Sprite.prototype._def = null;

Sprite.prototype.setDef = function(def) { this._def = def; };
Sprite.prototype.getDef = function(def) { return this._def; };

Sprite.prototype.setup = function() {
	// subclasses can override this
	// called before init()
};

Sprite.prototype.init = function() {
	// Create sprite div
	if (!this.id) this.id = _get_unique_id();
	this.require('port', 'url', 'width', 'height');
	
	// try to find our definition from game
	this._def = gGame._sprite_defs[ this.__name ] || null;
	
	if (!this.offsetX) this.offsetX = 0;
	if (!this.offsetY) this.offsetY = 0;

	this.globalID = this.port.id + '_' + this.id;
	this.div = document.createElement('DIV');
	this.style = this.div.style;
	this.div.setAttribute('id', this.globalID);
	this.div.id = this.globalID;
	this.style.position = 'absolute';
	this.setImage();
	
	// delay moving sprite into true position until draw()
	this.style.left = '-4000px';
	this.style.top = '-4000px';
	
	this.style.zIndex = this.zIndex;
	this.style.visibility = this.visible ? "visible" : "hidden";
	this._updateOpacity();
	
	if (ua.ie) this.div.setAttribute( 'onselectstart', "return false" );
	
	this.port.div.appendChild(this.div);
	
	if (this.mouseCaptured) {
		this.captureMouse();
	}
};

Sprite.prototype.reset = function() {
	// delete all graphical elements (probably for re-zoom)
	try { this.port.div.removeChild(this.div); } catch (e) {
		// try one last time
		var _div = el( this.globalID );
		try { this.port.div.removeChild(_div); } catch (e) { ; };
	}
	this.style = null;
	this.div = null;
};

Sprite.prototype.setImage = function(_url) {
	// set new image for sprite -- must update everything
	// only do this for major events -- NOT animation
	if (_url) this.url = _url;
	
	// see if we can lookup actual url in our definition
	if (this._def && this._def._image_urls && this._def._image_urls[this.url]) {
		this.url = this._def._image_urls[this.url];
	}
	
	var _image = gGame._imageLoader.lookupImage( this.url );
	// assert(image && image.loaded && image.img && image.img.width, "Sprite image "+this.url+" is not loaded" );
	if (!_image) return _throwError(this.__name + ": Sprite image not found: " + this.url);
	if (!_image.loaded || !_image.img || !_image.img.width) return _throwError(this.__name + ": Sprite image " + this.url + " is not yet loaded.");
	var _img = _image.img;
	this.img = _img;
	
	if (!this.width) this.width = this.unzoom( _img.width );
	if (!this.height) this.height = this.unzoom( _img.height );
	
	// special handling for "rotate_pad"
	if (this.url.match(/\bfilter\=rotate_pad\b/)) {
		var _padding = this.unzoom(_img.height) - this.height;
		this.width = this.unzoom(_img.height); // YES THIS IS DELIBERATE
		this.height = this.unzoom(_img.height);
		this.offsetX = 0 - Math.floor(_padding / 2);
		this.offsetY = 0 - Math.floor(_padding / 2);
	}
	
	if (ua.clipnest) {
		// clipnest technique, for safari and ie6
		this.style.width = _img.width + 'px';
		this.style.height = _img.height + 'px';
		this.style.clip = this._getClipStyle();
	}
	else {
		// all other browsers use background position
		this.style.width = '' + this.zoom(this.width) + 'px';
		this.style.height = '' + this.zoom(this.height) + 'px';
		this.style.backgroundPosition = this._getBkgndPos();
	}
	this.style.left = this._getScreenX() + 'px';
	this.style.top = this._getScreenY() + 'px';
	
	if (ua.ie6 && this.url.match(/\.png(\?|$)/i)) {
		// IE 6 requires special handling for PNG images
		this.div.innerHTML = "<div "
			+ " style=\"" + "width:" + _img.width + "px; height:" + _img.height + "px;"
			+ "filter:progid:DXImageTransform.Microsoft.AlphaImageLoader"
			+ "(src=\'" + _img.src + "\', sizingMethod='scale');\"></div>";
	}
	else if (ua.clipnest) {
		// safari and ie6 like a nested image in the div (go figure)
		this.div.innerHTML = '<img src="'+_img.src+'" width="'+_img.width+'" height="'+_img.height+'" border="0"/>' + "\n";
	}
	else {
		// most browsers prefer the background position technique (classic CSS sprite)
		this.style.backgroundImage = 'url(' + _img.src + ')';
	}
	
	this._dirtyClip = 1;
	this._oldScreenX = -99999;
	this._oldScreenY = -99999;
	this._oldFrameX = -1;
	this._oldFrameY = -1;
	
	return this;
};

Sprite.prototype.setRotation = function(_degrees) {
	// simulate sprite rotation using image strip
	if (!this.img) return this;
	
	if (_degrees < 0) _degrees = 360 - ((-1 * _degrees) % 360);
	else if (_degrees >= 360) _degrees = _degrees % 360;
	
	var _max_frames = Math.floor( this.unzoom(this.img.width) / this.width );
	this.setFrameX( Math.floor( (_degrees / 360) * _max_frames ) );
	
	return this;
};

Sprite.prototype.setScale = function(_scale) {
	// simulate sprite scale using image strip
	if (!this.img) return this;
	
	if (_scale < 0) _scale = 0;
	if (_scale > 1.0) _scale = 1.0;
	
	var _max_frames = Math.floor( this.unzoom(this.img.width) / this.width );
	this.setFrameX( Math.floor( _scale * _max_frames ) );
	
	return this;
};

Sprite.prototype.setBackground = function(_url) {
	// set new background image
	// only do this for major events -- NOT animation
	if (ua.ue6 && url.match(/\.png$/i)) {
		// TODO: this will fail in IE6 because 'filter' is used for alpha!
		this.style.filter = "progid:DXImageTransform.Microsoft.AlphaImageLoader"
		+ "(src=\'" + gImageLoader.getImageURL(_url) + "\', sizingMethod='scale')";
	}
	else {
		this.style.backgroundImage = 'url(' + gImageLoader.getImageURL(_url) + ')';
	}
	
	return this;
};

Sprite.prototype.setZIndex = function(_newIdx) {
	// set new zIndex
	_newIdx = parseInt(_newIdx, 10);
	if (_newIdx < 1) _newIdx = 1;
	if (_newIdx > 999) _newIdx = 999;
	if (this.style) this.style.zIndex = _newIdx;
	this.zIndex = _newIdx;
	
	return this;
};

Sprite.prototype.setOpacity = function(_newOpacity) {
	// set new opacity, will update on next draw()
	if (_newOpacity != this.opacity) {
		this.opacity = _newOpacity;
		this._dirtyClip = 1;
	}
	
	return this;
};

Sprite.prototype._updateOpacity = function() {
	// update opacity for div
	var _opacity = this.opacity * this.plane.opacity;
	this.style.visibility = (_opacity && this.visible) ? "visible" : "hidden";
	
	if ((_opacity > 0) && (_opacity < 1.0)) {
		this.style.opacity = _opacity;
		if (ua.moz) this.style.MozOpacity = _opacity;
		else if (ua.ie) this.style.filter = "alpha(opacity=" + parseInt(_opacity * 100, 10) + ")";
	}
	else {
		this.style.opacity = 1.0;
		if (ua.moz) this.style.MozOpacity = 1.0;
		else if (ua.ie) this.style.filter = "";
	}
};

Sprite.prototype._getBkgndPos = function() {
	// return backgrond position for non-safari, non-ie browsers
	
	// set these to 0 for getScreenX/Y
	this.clipX = 0;
	this.clipY = 0;
	
	return '' + Math.floor( 0 - this.zoom(this.frameX * this.width) ) + 'px ' + Math.floor( 0 - this.zoom(this.frameY * this.height) ) + 'px';
};

Sprite.prototype._getClipStyle = function() {
	// get clip rect for sprite	
	this.clipX = Math.floor( this.frameX * this.width );
	this.clipY = Math.floor( this.frameY * this.height );
	
	// clip may not be needed at all (but this optimization crashes IE6 SP2)
	// if ((this.width == parseInt(this.style.width)) && (this.height == parseInt(this.style.height))) return '';

	return 'rect(' + this.zoom(this.clipY) + 'px ' + this.zoom(this.clipX + this.width) + 'px ' + 
		this.zoom(this.clipY + this.height) + 'px ' + this.zoom(this.clipX) + 'px)';
};

Sprite.prototype._getScreenX = function() {
	// get horiz position of sprite on screen
	return this.zoom( ((Math.floor(this.x + this.offsetX) - this.clipX) - this.plane.scrollX) + this.plane.offsetX );
};

Sprite.prototype._getScreenY = function() {
	// get vert position of sprite on screen
	return this.zoom( ((Math.floor(this.y + this.offsetY) - this.clipY) - this.plane.scrollY) + this.plane.offsetY );
};

Sprite.prototype.isOnScreen = function() {
	// return true if sprite is onscreen, false otherwise
	return this.plane.getScreenRect().rectIn( this.getRect() );
};

Sprite.prototype.draw = function() {
	// update screen position
	if (this._dirtyClip) {
		
		if (ua.clipnest) this.style.clip = this._getClipStyle();
		else this.style.backgroundPosition = this._getBkgndPos();
		
		this._updateOpacity();
		this._dirtyClip = 0;
	}
	
	var _screenX = this._getScreenX();
	var _screenY = this._getScreenY();
	
	// if (!parseInt(screenX)) debugstr("Bad screenX: " + screenX + ": " + this.type + ": " + this.id);
	// if (!parseInt(screenX)) debugstr("Bad screenX: " + screenX + ": " + this.type + ": " + this.id);
	
	if ((_screenX != this._oldScreenX) || (_screenY != this._oldScreenY)) {
		this.style.left = _screenX + 'px';
		this.style.top = _screenY + 'px';

		if (this.dieOffscreen) {
			var _die = 0;
			if (this.x + this.width < this.plane.scrollX - (this.port.portWidth * this.plane._dieOffscreenDistance)) _die = 1;
			else if (this.y + this.height < this.plane.scrollY - (this.port.portHeight * this.plane._dieOffscreenDistance)) _die = 1;
			else if (this.x >= this.plane.scrollX + this.port.portWidth + (this.port.portWidth * this.plane._dieOffscreenDistance)) _die = 1;
			else if (this.y >= this.plane.scrollY + this.port.portHeight + (this.port.portHeight * this.plane._dieOffscreenDistance)) _die = 1;

			if (_die) this.destroy();
		} // dieOffscreen
		
		else if (this._aether) {
			var _die = 0;
			if (this.x + this.width < this.plane.scrollX - (this.port.portWidth * this.plane._aetherDistance)) _die = 1;
			else if (this.y + this.height < this.plane.scrollY - (this.port.portHeight * this.plane._aetherDistance)) _die = 1;
			else if (this.x >= this.plane.scrollX + this.port.portWidth + (this.port.portWidth * this.plane._aetherDistance)) _die = 1;
			else if (this.y >= this.plane.scrollY + this.port.portHeight + (this.port.portHeight * this.plane._aetherDistance)) _die = 1;

			if (_die) {
				this.sendToAether();
			} // yes _die
		} // aether
		
		else if (this.screenLoop) {
			// screen repeat loop (like asteroids)
			if (this.x + this.width < this.plane.scrollX) this.x = this.plane.scrollX + this.port.portWidth;
			else if (this.y + this.height < this.plane.scrollY) this.y = this.plane.scrollY + this.port.portHeight;
			else if (this.x >= this.plane.scrollX + this.port.portWidth) this.x = this.plane.scrollX - this.width;
			else if (this.y >= this.plane.scrollY + this.port.portHeight) this.y = this.plane.scrollY - this.height;
		}
		
		this._oldScreenX = _screenX;
		this._oldScreenY = _screenY;
	} // sprite moved
};

Sprite.prototype.sendToAether = function() {
	// send back into aether for respawning
	if (this._aether) {
		this.destroy();
		
		// only copy back aether keys (x, y, etc.)
		for (var _key in this._aether) {
			this._aether[_key] = this[_key];
		} // foreach aether key
		
		// determine which chunk is appropriate
		var _aetherKey = this.plane._getAetherKey(this.x, this.y);
		if (!this.plane._aether[_aetherKey]) this.plane._aether[_aetherKey] = [];
		_array_push( this.plane._aether[_aetherKey], this._aether );
	}
	return this;
};

Sprite.prototype.isAether = function() {
	// check if sprite is managed by aether
	return !!this._aether;
};

Sprite.prototype.removeFromAether = function() {
	// remove sprite from aether database
	if (this._aether) delete this._aether;
	return this;
};

Sprite.prototype.addAetherProp = function() {
	// add one or more properties to the aether object
	if (this._aether) {
		for (var _idx = 0, _len = arguments.length; _idx < _len; _idx++) {
			var _name = arguments[_idx];
			switch (typeof(this[_name])) {
				case 'string':
				case 'number':
					this._aether[_name] = this[_name];
					break;
			}
		}
	}
	return this;
};

Sprite.prototype.getAetherObj = function() {
	// return intenral aether object (used by level editor)
	return this._aether;
};

Sprite.prototype.logic = function() {
	// placeholder for logic routine
	// override in subclasses
};

Sprite.prototype.destroy = function() {
	// prep for deletion
	if (this.div && !this.destroyed) {
		try { this.port.div.removeChild(this.div); } catch (e) {
			this.style.left = "-1000px";
			this.style.visibility = "hidden";
			
			// try one last time (ie sometimes has trouble with this)
			var _div = el( this.globalID );
			try { this.port.div.removeChild(_div); } catch (e) { ; };
		};
		this.destroyed = 1;
	}
	return this;
};

Sprite.prototype.hide = function() {
	this.style.visibility = 'hidden';
	this.visible = false;
	return this;
};

Sprite.prototype.show = function(_state) {
	if (typeof(_state) == 'undefined') _state = true;
	this.style.visibility = _state ? 'visible' : 'hidden';
	this.visible = _state;
	return this;
};

Sprite.prototype.setFrame = function(_fx, _fy) {
	// set sprite animation frame
	if (!_fx) _fx = 0;
	if (!_fy) _fy = 0;
	this.frameX = parseInt(_fx, 10);
	this.frameY = parseInt(_fy, 10);

	if ((_fx != this._oldFrameX) || (_fy != this._oldFrameY))
		this._dirtyClip = 1; // flag clip for update
	
	this._oldFrameX = _fx;
	this._oldFrameY = _fy;
	return this;
};

Sprite.prototype.setFrameX = function(_fx) {
	// set sprite animation frame
	if (!_fx) _fx = 0;
	this.frameX = parseInt(_fx, 10);

	if (_fx != this._oldFrameX)
		this._dirtyClip = 1; // flag clip for update
	
	this._oldFrameX = _fx;
	return this;
};

Sprite.prototype.setFrameY = function(_fy) {
	// set sprite animation frame
	if (!_fy) _fy = 0;
	this.frameY = parseInt(_fy, 10);

	if (_fy != this._oldFrameY)
		this._dirtyClip = 1; // flag clip for update
	
	this._oldFrameY = _fy;
	return this;
};

Sprite.prototype.zoom = function(_value) {
	// apply portal zoom level to specified value
	return Math.floor( _value * this.port._zoomLevel );
};

Sprite.prototype.unzoom = function(_value) {
	// remove portal zoom level from specified value
	return Math.floor( _value / this.port._zoomLevel );
};

Sprite.prototype.getRect = function() {
	// return Rect moved to sprite's global position
	var _rect = new Rect();
	
	if (this.hitRect) _rect.set(this.hitRect);
	else _rect.set(0, 0, this.width, this.height);
	
	_rect.offset(this.x, this.y);
	return _rect;
};

Sprite.prototype.setPosFromRect = function(_newRect) {
	// set new position from rect (consider hitRect for this)
	if (this.hitRect) {
		this.x = _newRect.left - this.hitRect.left;
		this.y = _newRect.top - this.hitRect.top;
	}
	else {
		this.x = _newRect.left;
		this.y = _newRect.top;
	}
	return this;
};

Sprite.prototype.isMouseOver = function() {
	// return true if mouse is currently over sprite, false otherwise
	var _pt = this.plane.getMouseCoords();
	if (!_pt) return false;
	return this.pointIn(_pt);
};

Sprite.prototype.ptIn = function(_px, _py) {
	// LEGACY METHOD, DO NOT USE
	// check if point is inside our rect
	if (this.hitRect) {
		return (
			(_px >= this.x + this.hitRect.left) && (_py >= this.y + this.hitRect.top) && 
			(_px < this.x + this.hitRect.right) && (_py < this.y + this.hitRect.bottom)
		);
	}
	else {
		return(
			(_px >= this.x) && (_py >= this.y) && 
			(_px < this.x + this.width) && (_py < this.y + this.height)
		);
	}
};

Sprite.prototype.pointIn = function(_pt) {
	// check if point is inside our rect
	if (this.hitRect)
		return (
			(_pt.x >= this.x + this.hitRect.left) && (_pt.y >= this.y + this.hitRect.top) && 
			(_pt.x < this.x + this.hitRect.right) && (_pt.y < this.y + this.hitRect.bottom)
		);
	else
		return(
			(_pt.x >= this.x) && (_pt.y >= this.y) && 
			(_pt.x < this.x + this.width) && (_pt.y < this.y + this.height)
		);
};

Sprite.prototype.rectIn = function(_tempRect) {
	// check if rect is inside our rect
	return this.getRect().rectIn( _tempRect );
};

Sprite.prototype.centerPointX = function() {
	// get horiz center point
	return (this.x + (this.width / 2));
};

Sprite.prototype.centerPointY = function() {
	// get vert center point
	return (this.y + (this.height / 2));
};

Sprite.prototype.centerPoint = function() {
	// get point at sprite's center
	return new Point( this.centerPointX(), this.centerPointY() );
};

Sprite.prototype.move = function(_xd, _yd, _sprite_plane, _tilePlane) {
	// move sprite, return collision event or null
	if (typeof(_xd) == 'undefined') _xd = this.xd;
	if (typeof(_yd) == 'undefined') _yd = this.yd;
	if (!_xd && !_yd) return null;
	
	if (!this.collisions) {
		// no collision detection, just move it
		this.x += _xd;
		this.y += _yd;
		return null;
	}
	
	var _hits = [];
	
	if (typeof(_sprite_plane) == 'undefined') _sprite_plane = this.plane;
	
	var _sourceRect = this.getRect();
	var _destRect = _sourceRect.clone().offset(_xd, _yd);
	
	if (_sprite_plane) {
		var _pt = new Point(0, 0);
		var _dist = _pt.getDistance( _xd, _yd );
		if (!_dist) return null;
	
		var _idx = 0;
		var _sprite_ids_hit = {};
		
		while (_idx < _dist) {
			_idx += _sprite_plane._minSpriteSize; if (_idx > _dist) _idx = _dist;
			var _tempRect = _sourceRect.clone().morph(_destRect, _idx / _dist);
		
			for (var _key in _sprite_plane.sprites) {
				var _sprite = _sprite_plane.sprites[_key];
				if ((_sprite.id != this.id) && _sprite.collisions && !_sprite.destroyed && !_sprite_ids_hit[_sprite.id] && _sprite.rectIn(_tempRect)) {
					var _newRect = _destRect.clone();
					if (_sprite.solid) {
						var _spriteRect = _sprite.getRect();
						var _maxIdx = _idx;
						var _minIdx = _idx - _sprite_plane._minSpriteSize; if (_minIdx < 0) _minIdx = 0;
					
						// TODO: optimize this by doing powers of 2 trick
						for (var _idy = _maxIdx - 1; _idy >= _minIdx; _idy--) {
							var _colRect = _sourceRect.clone().morph(_destRect, _idy / _dist);
							if (!_spriteRect.rectIn(_colRect)) {
								_newRect = _colRect;
								_idy = _minIdx - 1;
							}
						}
					}
					else if (_sprite.ground && (_yd > 0)) {
						_newRect.moveTo( _newRect.left, _sprite.getRect().top - _newRect.height() );
					}
				
					var _hit = {
						_newRect: _newRect,
						type: 'collision',
						targetType: 'sprite',
						target: _sprite
					};
					_hits.push( _hit );
					
					_sprite_ids_hit[_sprite.id] = 1; // prevent dupes
				} // collision
			} // foreach sprite
		} // move 16px at a time
	} // sprite_plane
	
	if (typeof(_tilePlane) == 'undefined') {
		_tilePlane = _sprite_plane ? _sprite_plane.tilePlane : this.plane.tilePlane;
	}
	
	// tile collisions
	if (_tilePlane && _tilePlane.objectData) {
		// order based on largest delta axis
		var _axis_order = ['x', 'y'];
		if (Math.abs(_yd) > Math.abs(_xd)) _axis_order = ['y', 'x'];
		
		for (var _idx = 0; _idx < 2; _idx++) {
			switch (_axis_order[_idx]) {
				case 'x':
					if (_xd < 0) {
						var _hit = this.plane.moveLineX( _sourceRect.left, _sourceRect.top, _sourceRect.bottom, _xd, false, _tilePlane );
						if (_hit) {
							_hit._newRect = _destRect.clone().moveTo( _hit.correctedX, _destRect.top );
							_hits.push( _hit );
						}
					}
					else if (_xd > 0) {
						var _hit = this.plane.moveLineX( _sourceRect.right - 1, _sourceRect.top, _sourceRect.bottom, _xd, false, _tilePlane );
						if (_hit) {
							_hit._newRect = _destRect.clone().moveTo( (_hit.correctedX - _destRect.width()) + 1, _destRect.top );
							_hits.push( _hit );
						}
					}
					_sourceRect.offset( _xd, 0 );
					break;
				
				case 'y':
					if (_yd < 0) {
						var _hit = this.plane.moveLineY( _sourceRect.top, _sourceRect.left, _sourceRect.right, _yd, false, _tilePlane );
						if (_hit) {
							_hit._newRect = _destRect.clone().moveTo( _destRect.left, _hit.correctedY );
							_hits.push( _hit );
						}
					}
					else if (_yd > 0) {
						var _hit = this.plane.moveLineY( _sourceRect.bottom - 1, _sourceRect.left, _sourceRect.right, _yd, false, _tilePlane );
						if (_hit) {
							_hit._newRect = _destRect.clone().moveTo( _destRect.left, (_hit.correctedY - _destRect.height()) + 1 );
							_hits.push( _hit );
						}
					}
					_sourceRect.offset( 0, _yd );
					break;
			} // switch axis
		} // order loop
	} // tile plane attached
	
	if (_hits.length == 1) {
		this.setPosFromRect( _hits[0]._newRect );
		return _hits[0];
	}
	else if (_hits.length) {
		// determine "best" event -- the one moved furthest from the target point
		var _best_hit = null;
		var _best_dist = -1;
		
		for (var _idx = 0, _len = _hits.length; _idx < _len; _idx++) {
			var _hit = _hits[_idx];
			var _dist = _hit._newRect.topLeftPoint().getDistance( _destRect.topLeftPoint() );
			if (_dist > _best_dist) {
				_best_hit = _hit;
				_best_dist = _dist;
			}
		}
		this.setPosFromRect( _best_hit._newRect );
		_best_hit.events = _hits;
		return _best_hit;
	} // we hit something
	
	// no collisions, move to destination
	this.setPosFromRect( _destRect );
	return null;
};

Sprite.prototype.require = function() {
	// make sure required class members exist
	for (var _idx = 0, _len = arguments.length; _idx < _len; _idx++) {
		if (typeof(this[arguments[_idx]]) == 'undefined') {
			return _throwError(this.type + " " + this.id + ": Missing required parameter: " + arguments[_idx]);
		}
	}
	return true;
};

Sprite.prototype.tween = function(_args) {
	// tween object properties
	_args.target = this;
	this.lastTween = gTween.addTween(_args);
	return this;
};

Sprite.prototype.onTweenUpdate = function(_tween) {
	// special care must be taken depending on which properties are being tweened
	var _props = _tween.properties;
	if (_props.zIndex) this.setZIndex( this.zIndex );
	if (_props.opacity || _props.frameX || _props.frameY) this._dirtyClip = true;
};

Sprite.prototype.setKeyHandler = function() {
	// set sprite object as key handler for one or more key defs
	for (_idx = 0, _len = arguments.length; _idx < _len; _idx++) {
		gGame.setKeyHandler( arguments[_idx], this );
	}
	return this;
};

Sprite.prototype.get2DSoundSettings = function(_max_dist) {
	// calculate spacial volume / balance based on sprite position
	if (!_max_dist) _max_dist = Math.max(this.port.portWidth, this.port.portHeight);
	
	var _spriteCenterPt = new Point(
		((this.x + this.offsetX + (this.width / 2)) - this.plane.scrollX) + this.plane.offsetX,
		((this.y + this.offsetY + (this.height / 2)) - this.plane.scrollY) + this.plane.offsetY
	);
	
	var _screenCenterPt = new Point(
		this.port.portWidth / 2,
		this.port.portHeight / 2
	);
	
	var _volume = 0;
	var _dist = _screenCenterPt.getDistance( _spriteCenterPt );
	if (_dist < _max_dist) {
		_volume = 1.0 - (_dist / _max_dist);
	}
	
	// calculate balance using the X distance only
	var _xDist = Math.abs( _screenCenterPt.x - _spriteCenterPt.x );
	if (_xDist > _max_dist) _xDist = _max_dist;
	
	var _balance = (_xDist / _max_dist) * 2;
	if (_balance > 1.0) _balance = 1.0;
	if (_spriteCenterPt.x < _screenCenterPt.x) _balance *= -1;
	
	return {
		volume: _volume,
		balance: _balance
	};
};

Sprite.prototype.playSound2D = function(_sound_id, _max_dist) {
	// play spacial sound effect based on sprite position relative to center of screen
	var _track = gAudio.getTrack(_sound_id);
	if (!_track) return _throwError("Could not locate audio track: " + _sound_id);
	
	var _settings = this.get2DSoundSettings(_max_dist);
	if (!_settings.volume) return false; // too far away to hear
	
	debugstr("Playing 2D sound: " + _sound_id + ": volume " + _settings.volume + ", balance " + _settings.balance );
	
	_track.setVolume( _settings.volume );
	_track.setBalance( _settings.balance );
	
	_track.playSound();
	return true;
};

Sprite.prototype.captureMouse = function() {
	// capture mouse clicks for this sprite's div
	this.mouseCaptured = true;
	this.div.captureMouse = this;
	
	var self = this;
	this.div.onmouseover = function() {
		if (gGame.inGame && self.onMouseOver) self.onMouseOver();
	};
	this.div.onmouseout = function() {
		if (gGame.inGame && self.onMouseOut) self.onMouseOut();
	};
	
	return this;
};
