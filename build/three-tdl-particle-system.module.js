import { Mesh, Matrix4, Vector3, InstancedBufferGeometry, InterleavedBuffer, NormalBlending, Vector4, BufferGeometry, InterleavedBufferAttribute, BufferAttribute, InstancedInterleavedBuffer, DynamicDrawUsage, ShaderMaterial, DoubleSide, FrontSide, DataTexture, RGBAFormat, LinearFilter } from 'three';

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction

var CORNERS_ = [

	[ - 0.5, - 0.5 ],
	[ + 0.5, - 0.5 ],
	[ + 0.5, + 0.5 ],
	[ - 0.5, + 0.5 ]

];

function createDefaultClock_ ( particleSystem ) {

	return function () {

		var now = particleSystem.now_;
		var base = particleSystem.timeBase_;

		return ( now.getTime() - base.getTime() ) / 1000.0;

	}

}

var POSITION_START_TIME_IDX = 0;
var UV_LIFE_TIME_FRAME_START_IDX = 4;
var VELOCITY_START_SIZE_IDX = 8;
var ACCELERATION_END_SIZE_IDX = 12;
var SPIN_START_SPIN_SPEED_IDX = 16;
var ORIENTATION_IDX = 20;
var COLOR_MULT_IDX = 24;
var LAST_IDX = 28;
var singleParticleArray_ = new Float32Array( 4 * LAST_IDX );

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js
// ported to three.js by fazeaction

function ParticleSpec () {

	this.numParticles = 1;

	this.numFrames = 1;

	this.frameDuration = 1;

	this.frameStart = 0;

	this.frameStartRange = 0;

	this.timeRange = 99999999;

	this.startTime = null;

	this.lifeTime = 1;

	this.lifeTimeRange = 0;

	this.startSize = 1;

	this.startSizeRange = 0;

	this.endSize = 1;

	this.endSizeRange = 0;

	this.position = [ 0, 0, 0 ];

	this.positionRange = [ 0, 0, 0 ];

	this.velocity = [ 0, 0, 0 ];

	this.velocityRange = [ 0, 0, 0 ];

	this.acceleration = [ 0, 0, 0 ];

	this.accelerationRange = [ 0, 0, 0 ];

	this.spinStart = 0;

	this.spinStartRange = 0;

	this.spinSpeed = 0;

	this.spinSpeedRange = 0;

	this.colorMult = [ 1, 1, 1, 1 ];

	this.colorMultRange = [ 0, 0, 0, 0 ];

	this.worldVelocity = [ 0, 0, 0 ];

	this.worldAcceleration = [ 0, 0, 0 ];

	this.billboard = true;

	this.orientation = [ 0, 0, 0, 1 ];

}

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class OneShot extends Mesh {
	constructor(emitter, scene) {
		super();
		this.emitter_ = emitter.clone();
		this.scene = scene;

		this.world_ = new Matrix4();
		this.tempWorld_ = new Matrix4();
		this.timeOffset_ = 0;
		this.visible_ = false;

		// Remove the parent emitter from the particle system's drawable
		// list (if it's still there) and add ourselves instead.
		var particleSystem = emitter.particleSystem;
		var idx = particleSystem.drawables_.indexOf(this.emitter_);
		if (idx >= 0) {

			particleSystem.drawables_.splice(idx, 1);

		}

		particleSystem.drawables_.push(this);
	}

	trigger ( opt_world ) {

		if ( ! this.visible_ ) {

			this.scene.add( this.emitter_ );

		}
		if ( opt_world ) {

			this.emitter_.position.copy( new Vector3().fromArray( opt_world ) );

		}
		this.visible_ = true;
		this.timeOffset_ = this.emitter_.timeSource_();

	}

	draw ( world, viewProjection, timeOffset ) {

		if ( this.visible_ ) {

			//this.tempWorld_.multiplyMatrices(this.world_, world);
			this.emitter_.draw( this.world_, viewProjection, this.timeOffset_ );

		}

	}

}

var billboardParticleInstancedVertexShader = "// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js#L154\r\n\r\nuniform mat4 viewInverse;\r\nuniform vec3 worldVelocity;\r\nuniform vec3 worldAcceleration;\r\nuniform float timeRange;\r\nuniform float time;\r\nuniform float timeOffset;\r\nuniform float frameDuration;\r\nuniform float numFrames;\r\n\r\n// Incoming vertex attributes\r\nattribute vec4 uvLifeTimeFrameStart;\r\nattribute float startTime;\r\nattribute vec4 velocityStartSize;\r\nattribute vec4 accelerationEndSize;\r\nattribute vec4 spinStartSpinSpeed;\r\nattribute vec4 colorMult;\r\n\r\n// Outgoing variables to fragment shader\r\nvarying vec2 outputTexcoord;\r\nvarying float outputPercentLife;\r\nvarying vec4 outputColorMult;\r\n\r\nvoid main() {\r\n    float lifeTime = uvLifeTimeFrameStart.z;\r\n    float frameStart = uvLifeTimeFrameStart.w;\r\n    vec3 velocity = (modelMatrix * vec4(velocityStartSize.xyz,\r\n                                 0.)).xyz + worldVelocity;\r\n    float startSize = velocityStartSize.w;\r\n    vec3 acceleration = (modelMatrix * vec4(accelerationEndSize.xyz,\r\n                                     0)).xyz + worldAcceleration;\r\n    float endSize = accelerationEndSize.w;\r\n    float spinStart = spinStartSpinSpeed.x;\r\n    float spinSpeed = spinStartSpinSpeed.y;\r\n\r\n    float localTime = mod((time - timeOffset - startTime), timeRange);\r\n    float percentLife = localTime / lifeTime;\r\n\r\n    float frame = mod(floor(localTime / frameDuration + frameStart),\r\n                     numFrames);\r\n    float uOffset = frame / numFrames;\r\n    float u = uOffset + (uv.x + 0.5) * (1. / numFrames);\r\n\r\n    outputTexcoord = vec2(u, uv.y + 0.5);\r\n    outputColorMult = colorMult;\r\n\r\n    vec3 basisX = viewInverse[0].xyz;\r\n    vec3 basisZ = viewInverse[1].xyz;\r\n    vec4 vertexWorld = modelMatrix * vec4(position, 1.0);\r\n\r\n    float size = mix(startSize, endSize, percentLife);\r\n    size = (percentLife < 0. || percentLife > 1.) ? 0. : size;\r\n    float s = sin(spinStart + spinSpeed * localTime);\r\n    float c = cos(spinStart + spinSpeed * localTime);\r\n\r\n    vec2 rotatedPoint = vec2(uv.x * c + uv.y * s, -uv.x * s + uv.y * c);\r\n    vec3 localPosition = vec3(basisX * rotatedPoint.x + basisZ * rotatedPoint.y) * size +\r\n                        velocity * localTime +\r\n                        acceleration * localTime * localTime +\r\n                        vertexWorld.xyz;\r\n\r\n    outputPercentLife = percentLife;\r\n    gl_Position = projectionMatrix * viewMatrix * vec4(localPosition, 1.);\r\n\r\n}";

var orientedParticleInstancedVertexShader = "// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js#L63\r\n\r\n// 3D (oriented) vertex shader\r\nuniform mat4 worldViewProjection;\r\nuniform mat4 world;\r\nuniform vec3 worldVelocity;\r\nuniform vec3 worldAcceleration;\r\nuniform float timeRange;\r\nuniform float time;\r\nuniform float timeOffset;\r\nuniform float frameDuration;\r\nuniform float numFrames;\r\n\r\n// Incoming vertex attributes\r\nattribute vec3 offset;\r\nattribute vec4 uvLifeTimeFrameStart; // uv, lifeTime, frameStart\r\nattribute float startTime;    // position.xyz, startTime\r\nattribute vec4 velocityStartSize;    // velocity.xyz, startSize\r\nattribute vec4 accelerationEndSize;  // acceleration.xyz, endSize\r\nattribute vec4 spinStartSpinSpeed;   // spinStart.x, spinSpeed.y\r\nattribute vec4 orientation;          // orientation quaternion\r\nattribute vec4 colorMult;            // multiplies color and ramp textures\r\n\r\n// Outgoing variables to fragment shader\r\nvarying vec2 outputTexcoord;\r\nvarying float outputPercentLife;\r\nvarying vec4 outputColorMult;\r\nvoid main() {\r\nfloat lifeTime = uvLifeTimeFrameStart.z;\r\nfloat frameStart = uvLifeTimeFrameStart.w;\r\nvec3 velocity = (world * vec4(velocityStartSize.xyz,\r\n                              0.)).xyz + worldVelocity;\r\nfloat startSize = velocityStartSize.w;\r\nvec3 acceleration = (world * vec4(accelerationEndSize.xyz,\r\n                                  0)).xyz + worldAcceleration;\r\nfloat endSize = accelerationEndSize.w;\r\nfloat spinStart = spinStartSpinSpeed.x;\r\nfloat spinSpeed = spinStartSpinSpeed.y;\r\n\r\nfloat localTime = mod((time - timeOffset - startTime), timeRange);\r\nfloat percentLife = localTime / lifeTime;\r\n\r\nfloat frame = mod(floor(localTime / frameDuration + frameStart),\r\n                  numFrames);\r\nfloat uOffset = frame / numFrames;\r\nfloat u = uOffset + (uv.x + 0.5) * (1. / numFrames);\r\n\r\noutputTexcoord = vec2(u, uv.y + 0.5);\r\noutputColorMult = colorMult;\r\n\r\nfloat size = mix(startSize, endSize, percentLife);\r\nsize = (percentLife < 0. || percentLife > 1.) ? 0. : size;\r\nfloat s = sin(spinStart + spinSpeed * localTime);\r\nfloat c = cos(spinStart + spinSpeed * localTime);\r\n\r\nvec4 rotatedPoint = vec4((uv.x * c + uv.y * s) * size, 0.,\r\n                         (uv.x * s - uv.y * c) * size, 1.);\r\nvec3 center = velocity * localTime +\r\n              acceleration * localTime * localTime +\r\n              position +offset;\r\n\r\nvec4 q2 = orientation + orientation;\r\nvec4 qx = orientation.xxxw * q2.xyzx;\r\nvec4 qy = orientation.xyyw * q2.xyzy;\r\nvec4 qz = orientation.xxzw * q2.xxzz;\r\n\r\nmat4 localMatrix = mat4(\r\n    (1.0 - qy.y) - qz.z,\r\n    qx.y + qz.w,\r\n    qx.z - qy.w,\r\n    0,\r\n\r\n    qx.y - qz.w,\r\n    (1.0 - qx.x) - qz.z,\r\n    qy.z + qx.w,\r\n    0,\r\n\r\n    qx.z + qy.w,\r\n    qy.z - qx.w,\r\n    (1.0 - qx.x) - qy.y,\r\n    0,\r\n\r\n    center.x, center.y, center.z, 1);\r\nrotatedPoint = localMatrix * rotatedPoint;\r\noutputPercentLife = percentLife;\r\ngl_Position = projectionMatrix * modelViewMatrix * rotatedPoint;\r\n}";

var particleFragmentShader = "// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js#L225\r\n\r\n#ifdef GL_ES\r\nprecision mediump float;\r\n#endif\r\nuniform sampler2D rampSampler;\r\nuniform sampler2D colorSampler;\r\n\r\n// Incoming variables from vertex shader\r\nvarying vec2 outputTexcoord;\r\nvarying float outputPercentLife;\r\nvarying vec4 outputColorMult;\r\n\r\nvoid main() {\r\n    vec4 colorMult = texture2D(rampSampler, vec2(outputPercentLife, 0.5)) * outputColorMult;\r\n    gl_FragColor = texture2D(colorSampler, outputTexcoord) * colorMult;\r\n    // For debugging: requires setup of some uniforms and vertex\r\n    // attributes to be commented out to avoid GL errors\r\n    //gl_FragColor = vec4(1., 0., 0., 1.);\r\n}";

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class ParticleEmitter extends Mesh {
	constructor( particleSystem, opt_texture, opt_clock ) {
		super();

		opt_clock = opt_clock || particleSystem.timeSource_;

		//TODO make alternative to instanced buffer
		//this.particleBuffer_ = new THREE.BufferGeometry();
		//this.indexBuffer_ = [];

		this.isParticleEmitter = true;
		this.particleBuffer_ = new InstancedBufferGeometry();
		this.interleavedBuffer = new InterleavedBuffer();

		this.numParticles_ = 0;

		this.rampTexture_ = particleSystem.defaultRampTexture;
		this.colorTexture_ = opt_texture || particleSystem.defaultColorTexture;

		this.particleSystem = particleSystem;

		this.timeSource_ = opt_clock;

		this.setState(NormalBlending);
	}

	setTranslation ( x, y, z ) {

		this.position.x = x;
		this.position.y = y;
		this.position.z = z;

	}

	setState ( stateId ) {

		this.blendFunc_ = stateId;

	}

	setColorRamp ( colorRamp ) {

		var width = colorRamp.length / 4;
		if (width % 1 != 0) {

			throw 'colorRamp must have multiple of 4 entries';

		}

		if (this.rampTexture_ == this.particleSystem.defaultRampTexture) {

			this.rampTexture_ = null;

		}

		this.rampTexture_ = this.particleSystem.createTextureFromFloats( width, 1, colorRamp, this.rampTexture_ );

	}

	validateParameters ( parameters ) {

		var defaults = new ParticleSpec();

		for ( var key in parameters ) {

			if ( typeof defaults[ key ] === 'undefined' ) {

				throw 'unknown particle parameter "' + key + '"';

			}

		}

		for ( var key in defaults ) {

			if ( typeof parameters[ key ] === 'undefined' ) {

				parameters[ key ] = defaults[ key ];

			}

		}

	}

	createParticles_ ( firstParticleIndex, numParticles, parameters, opt_perParticleParamSetter ) {

		var interleaveBufferData = this.interleavedBuffer.array;

		this.billboard_ = parameters.billboard;

		var random = this.particleSystem.randomFunction_;

		var plusMinus = function ( range ) {

			return ( random() - 0.5 ) * range * 2;

		};

		// TODO: change to not allocate.
		var plusMinusVector = function ( range ) {

			var v = [];

			for (var ii = 0; ii < range.length; ++ ii) {

				v.push( plusMinus( range[ ii ] ) );

			}

			return v;

		};

		for ( var ii = 0; ii < numParticles; ++ ii ) {

			if ( opt_perParticleParamSetter ) {

				opt_perParticleParamSetter( ii, parameters );

			}

			var pLifeTime = parameters.lifeTime;
			var pStartTime = ( parameters.startTime === null ) ? ( ii * parameters.lifeTime / numParticles ) : parameters.startTime;
			var pFrameStart = parameters.frameStart + plusMinus(parameters.frameStartRange);
			var pPosition = new Vector3().addVectors( new Vector3().fromArray(parameters.position), new Vector3().fromArray(plusMinusVector(parameters.positionRange)));
			var pVelocity = new Vector3().addVectors( new Vector3().fromArray(parameters.velocity), new Vector3().fromArray(plusMinusVector(parameters.velocityRange)));
			var pAcceleration = new Vector3().addVectors( new Vector3().fromArray(parameters.acceleration), new Vector3().fromArray( plusMinusVector( parameters.accelerationRange )));
			var pColorMult = new Vector4().addVectors( new Vector4().fromArray(parameters.colorMult), new Vector4().fromArray(plusMinusVector( parameters.colorMultRange )));
			var pSpinStart = parameters.spinStart + plusMinus(parameters.spinStartRange);
			var pSpinSpeed = parameters.spinSpeed + plusMinus(parameters.spinSpeedRange);
			var pStartSize = parameters.startSize + plusMinus(parameters.startSizeRange);
			var pEndSize = parameters.endSize + plusMinus(parameters.endSizeRange);
			var pOrientation = new Vector4().fromArray(parameters.orientation);

			for (var jj = 0; jj < 1; ++jj) {

				var offset0 = LAST_IDX * jj + ( ii * LAST_IDX * 4 ) + ( firstParticleIndex * LAST_IDX * 4 );
				var offset1 = offset0 + 1;
				var offset2 = offset0 + 2;
				var offset3 = offset0 + 3;


				interleaveBufferData[POSITION_START_TIME_IDX + offset0] = pPosition.x;
				interleaveBufferData[POSITION_START_TIME_IDX + offset1] = pPosition.y;
				interleaveBufferData[POSITION_START_TIME_IDX + offset2] = pPosition.z;
				interleaveBufferData[POSITION_START_TIME_IDX + offset3] = pStartTime;

				interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset0] = CORNERS_[jj][0];
				interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset1] = CORNERS_[jj][1];
				interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset2] = pLifeTime;
				interleaveBufferData[UV_LIFE_TIME_FRAME_START_IDX + offset3] = pFrameStart;

				interleaveBufferData[VELOCITY_START_SIZE_IDX + offset0] = pVelocity.x;
				interleaveBufferData[VELOCITY_START_SIZE_IDX + offset1] = pVelocity.y;
				interleaveBufferData[VELOCITY_START_SIZE_IDX + offset2] = pVelocity.z;
				interleaveBufferData[VELOCITY_START_SIZE_IDX + offset3] = pStartSize;

				interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset0] = pAcceleration.x;
				interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset1] = pAcceleration.y;
				interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset2] = pAcceleration.z;
				interleaveBufferData[ACCELERATION_END_SIZE_IDX + offset3] = pEndSize;

				interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset0] = pSpinStart;
				interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset1] = pSpinSpeed;
				interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset2] = 0;
				interleaveBufferData[SPIN_START_SPIN_SPEED_IDX + offset3] = 0;

				interleaveBufferData[ORIENTATION_IDX + offset0] = pOrientation.x;
				interleaveBufferData[ORIENTATION_IDX + offset1] = pOrientation.y;
				interleaveBufferData[ORIENTATION_IDX + offset2] = pOrientation.z;
				interleaveBufferData[ORIENTATION_IDX + offset3] = pOrientation.w;

				interleaveBufferData[COLOR_MULT_IDX + offset0] = pColorMult.x;
				interleaveBufferData[COLOR_MULT_IDX + offset1] = pColorMult.y;
				interleaveBufferData[COLOR_MULT_IDX + offset2] = pColorMult.z;
				interleaveBufferData[COLOR_MULT_IDX + offset3] = pColorMult.w;

			}

		}

		this.interleavedBuffer.needsUpdate = true;

		this.material.uniforms.worldVelocity.value = new Vector3(parameters.worldVelocity[0], parameters.worldVelocity[1], parameters.worldVelocity[2]);
		this.material.uniforms.worldAcceleration.value = new Vector3(parameters.worldAcceleration[0], parameters.worldAcceleration[1], parameters.worldAcceleration[2]);
		this.material.uniforms.timeRange.value = parameters.timeRange;
		this.material.uniforms.frameDuration.value = parameters.frameDuration;
		this.material.uniforms.numFrames.value = parameters.numFrames;
		this.material.uniforms.rampSampler.value = this.rampTexture_;
		this.material.uniforms.colorSampler.value = this.colorTexture_;

		this.material.blending = this.blendFunc_;

	}

	allocateParticles_ ( numParticles, parameters ) {

		if ( this.numParticles_ != numParticles ) {

			var numIndices = 6 * numParticles;

			if (numIndices > 65536 && BufferGeometry.MaxIndex < 65536) {

				throw "can't have more than 10922 particles per emitter";

			}

			var vertexBuffer = new InterleavedBuffer( new Float32Array([
				// Front
				0, 0, 0, 0, -0.5, -0.5, 0, 0,
				0, 0, 0, 0, 0.5, -0.5, 0, 0,
				0, 0, 0, 0, 0.5, 0.5, 0, 0,
				0, 0, 0, 0, -0.5, 0.5, 0, 0
			]), 8);


			// Use vertexBuffer, starting at offset 0, 3 items in position attribute
			var positions = new InterleavedBufferAttribute( vertexBuffer, 3, 0 );
			this.particleBuffer_.setAttribute( 'position', positions );
			// Use vertexBuffer, starting at offset 4, 2 items in uv attribute
			var uvs = new InterleavedBufferAttribute( vertexBuffer, 2, 4 );
			this.particleBuffer_.setAttribute( 'uv', uvs );

			var indices = new Uint16Array([

				0, 1, 2,
				0, 2, 3

			]);

			this.particleBuffer_.setIndex( new BufferAttribute( indices, 1 ) );

			this.numParticles_ = numParticles;
			this.interleavedBuffer = new InstancedInterleavedBuffer( new Float32Array( numParticles * singleParticleArray_.byteLength ), LAST_IDX, 1 ).setUsage( DynamicDrawUsage );

			this.particleBuffer_.setAttribute( 'position', new InterleavedBufferAttribute(this.interleavedBuffer, 3, POSITION_START_TIME_IDX));
			this.particleBuffer_.setAttribute( 'startTime', new InterleavedBufferAttribute(this.interleavedBuffer, 1, 3));
			this.particleBuffer_.setAttribute( 'uvLifeTimeFrameStart', new InterleavedBufferAttribute(this.interleavedBuffer, 4, UV_LIFE_TIME_FRAME_START_IDX));
			this.particleBuffer_.setAttribute( 'velocityStartSize', new InterleavedBufferAttribute(this.interleavedBuffer, 4, VELOCITY_START_SIZE_IDX));
			this.particleBuffer_.setAttribute( 'accelerationEndSize', new InterleavedBufferAttribute(this.interleavedBuffer, 4, ACCELERATION_END_SIZE_IDX));
			this.particleBuffer_.setAttribute( 'spinStartSpinSpeed', new InterleavedBufferAttribute(this.interleavedBuffer, 4, SPIN_START_SPIN_SPEED_IDX));
			this.particleBuffer_.setAttribute( 'orientation', new InterleavedBufferAttribute(this.interleavedBuffer, 4, ORIENTATION_IDX));
			this.particleBuffer_.setAttribute( 'colorMult', new InterleavedBufferAttribute(this.interleavedBuffer, 4, COLOR_MULT_IDX));

			this.particleBuffer_.computeBoundingSphere();

			var uniforms = {

				//world: { type: 'm4', value: this.matrixWorld },
				viewInverse: { type: 'm4', value: this.particleSystem.camera.matrixWorld },
				worldVelocity: { type: 'v3', value: null },
				worldAcceleration: { type: 'v3', value: null },
				timeRange: { type: 'f', value: null },
				time: { type: 'f', value: null },
				timeOffset: { type: 'f', value: null },
				frameDuration: { type: 'f', value: null },
				numFrames: { type: 'f', value: null },
				rampSampler: { type: "t", value: this.rampTexture_ },
				colorSampler: { type: "t", value: this.colorTexture_ }

			};

			var material = new ShaderMaterial({

				uniforms: uniforms,
				vertexShader: ( parameters.billboard ) ? billboardParticleInstancedVertexShader : orientedParticleInstancedVertexShader,
				fragmentShader: particleFragmentShader,
				side: (this.billboard_)? DoubleSide : FrontSide,
				blending: this.blendFunc_,
				depthTest: true,
				depthWrite: false,
				transparent: true

			});


			this.geometry = this.particleBuffer_;
			this.material = material;

		}

	}

	setParameters ( parameters, opt_perParticleParamSetter ) {

		this.validateParameters ( parameters );

		var numParticles = parameters.numParticles;

		this.allocateParticles_ ( numParticles, parameters );
		this.createParticles_ ( 0, numParticles, parameters, opt_perParticleParamSetter );

	}

	draw ( world, viewProjection, timeOffset ) {

		var uniforms = this.material.uniforms;

		uniforms.time.value = this.timeSource_();
		uniforms.timeOffset.value = timeOffset;

	}

	createOneShot () {

		return new OneShot( this, this.particleSystem.scene );

	}

	clone ( object ) {

		if ( object === undefined ) object = this.particleSystem.createParticleEmitter( this.colorTexture_, this.timeSource_);

		object.geometry = this.geometry;
		object.material = this.material.clone();
		object.material.uniforms.viewInverse.value = this.particleSystem.camera.matrixWorld;
		object.material.uniforms.rampSampler.value = this.rampTexture_;
		object.material.uniforms.colorSampler.value = this.colorTexture_;

		super.copy( object );

		return object;

	}

}

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class Trail extends ParticleEmitter {
	constructor( particleSystem, maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock )	{
		super(particleSystem, opt_texture, opt_clock);

		this.allocateParticles_(maxParticles, parameters);
		this.validateParameters(parameters);

		this.parameters = parameters;
		this.perParticleParamSetter = opt_perParticleParamSetter;
		this.birthIndex_ = 0;
		this.maxParticles_ = maxParticles;
	}

	birthParticles ( position ) {

		var numParticles = this.parameters.numParticles;
		this.parameters.startTime = this.timeSource_();
		this.parameters.position = position;

		while ( this.birthIndex_ + numParticles >= this.maxParticles_ ) {

			var numParticlesToEnd = this.maxParticles_ - this.birthIndex_;

			this.createParticles_( this.birthIndex_, numParticlesToEnd,	this.parameters, this.perParticleParamSetter );
			numParticles -= numParticlesToEnd;

			this.birthIndex_ = 0;

		}

		this.createParticles_( this.birthIndex_, numParticles, this.parameters, this.perParticleParamSetter );

		if ( this.birthIndex_ === 0 ) {

			this.particleSystem.scene.add( this );

		}

		this.birthIndex_ += numParticles;


	}

}

// source: https://github.com/greggman/tdl/blob/master/tdl/particles.js

class ParticleSystem  {
	constructor( scene, camera, opt_clock, opt_randomFunction ) {
		this.scene = scene;
		this.camera = camera;

		this.drawables_ = [];

		var pixelBase = [0, 0.20, 0.70, 1, 0.70, 0.20, 0, 0];
		var pixels = [];

		for (var yy = 0; yy < 8; ++yy) {

			for (var xx = 0; xx < 8; ++xx) {

				var pixel = pixelBase[xx] * pixelBase[yy];
				pixels.push(pixel, pixel, pixel, pixel);

			}

		}

		var colorTexture = this.createTextureFromFloats(8, 8, pixels);
		var rampTexture = this.createTextureFromFloats(2, 1, [1, 1, 1, 1, 1, 1, 1, 0]);

		this.now_ = new Date();
		this.timeBase_ = new Date();

		if (opt_clock) {

			this.timeSource_ = opt_clock;

		} else {

			this.timeSource_ = createDefaultClock_(this);

		}

		this.randomFunction_ = opt_randomFunction || function () {

			return Math.random();

		};

		this.defaultColorTexture = colorTexture;
		this.defaultRampTexture = rampTexture;
	}

	createTextureFromFloats ( width, height, pixels, opt_texture ) {

		var texture = null;
		if ( opt_texture != null ) {

			texture = opt_texture;

		} else {

			var data = new Uint8Array( pixels.length );
			var t;
			for ( var i = 0; i < pixels.length; i ++ ) {

				t = pixels[ i ] * 255.;
				data[ i ] = t;

			}

			texture = new DataTexture( data, width, height, RGBAFormat );
			texture.minFilter = LinearFilter;
			texture.magFilter = LinearFilter;
			texture.needsUpdate = true;

			return texture;

		}

		return texture;

	}

	createParticleEmitter ( opt_texture, opt_clock ) {
		var emitter = new ParticleEmitter( this, opt_texture, opt_clock );
		this.drawables_.push( emitter );

		return emitter;

	}

	deleteEmitter(emitter) {
		let i = this.drawables_.indexOf(emitter);
		if(i>=0) this.drawables_.splice(i,1);
	}

	createTrail ( maxParticles, parameters, opt_texture, opt_perParticleParamSetter, opt_clock ) {

		var trail = new Trail( this, maxParticles, parameters, opt_texture, opt_perParticleParamSetter,	opt_clock );
		this.drawables_.push( trail );

		return trail;

	}

	draw ( viewProjection, world, viewInverse ) {

		this.now_ = new Date();

		for ( var ii = 0; ii < this.drawables_.length; ++ ii ) {

			this.drawables_[ ii ].draw( world, viewProjection, 0 );

		}

	}

}

export { ACCELERATION_END_SIZE_IDX, COLOR_MULT_IDX, CORNERS_, LAST_IDX, ORIENTATION_IDX, OneShot, POSITION_START_TIME_IDX, ParticleEmitter, ParticleSpec, ParticleSystem, SPIN_START_SPIN_SPEED_IDX, Trail, UV_LIFE_TIME_FRAME_START_IDX, VELOCITY_START_SIZE_IDX, createDefaultClock_, singleParticleArray_ };
