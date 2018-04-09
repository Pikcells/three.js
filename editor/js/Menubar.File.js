/**
 * @author mrdoob / http://mrdoob.com/
 */

Menubar.File = function ( editor ) {

	var NUMBER_PRECISION = 6;

	function parseNumber( key, value ) {

		return typeof value === 'number' ? parseFloat( value.toFixed( NUMBER_PRECISION ) ) : value;

	}

	var ExportMaterial = function ( name ) {

		name = name || "material";

		var zip = new JSZip();
		var materialFile = zip.folder(name);
		var materialObject = {};

		var matToExport;

		if ( editor.selected.material ){

			matToExport = editor.selected.material;

		}else{

			alert("No material selected");
			return;

		}

		materialObject = MakeMaterialObjectForMaterial( matToExport, materialFile, null, editor.selected );
		materialObject.type = matToExport.type;

		materialFile.file("material.json", JSON.stringify(materialObject));
		saveAs(zip.generate({type:"blob"}), name + ".zip");

	}

	var ExportImage = function ( image, name, file, levels ) {

		var canvas = document.createElement('CANVAS');
		var ctx = canvas.getContext('2d');

		levels = 1; // Disabling levels

		for ( var i=0; i<levels; i++ ){

			// Divide the size of the image by a factor of 2 for each level
			var height = image.height/Math.pow(2, i);
			var width = image.height/Math.pow(2, i);

			// Make sure the image is never too small to render
			if (height < 1)
				height = 1;
			if (width < 1)
				wdith = 1;

	    	canvas.height = height;
	    	canvas.width = width;
	    	ctx.drawImage(image, 
			    	0, 
			    	0, 
			    	height, 
			    	width);
	    	var dataURL = canvas.toDataURL('image/png');

	    	// Write the file out
	    	var imgBase64 = dataURL.split('base64,');
			file.file( name + ".png", imgBase64[1], {base64: true} );

		}

		canvas = null;
		context = null;

	}

	var MakeMaterialObjectForMaterial = function ( material, materialFile, index, model ) {

		if ( index == null )
			index = '';

		var materialObject = { };

		materialObject.side = material.side;
		materialObject.color = material.color.getHex();
		materialObject.normalMap = false;
		materialObject.metalnessMap = false;
		materialObject.roughnessMap = false;
		materialObject.alphaMap = false;
		materialObject.lightMapOverride = false;
		materialObject.diffuse = false;
		materialObject.type = material.type;

		if (material.envMapIntensity)
			materialObject.envMapIntensity = parseFloat(material.envMapIntensity);

		if ( material.type == "MeshPhysicalMaterial" ){

			materialObject.metalness = material.metalness;
			materialObject.roughness = material.roughness;

		}else {

			materialObject.reflectivity = material.reflectivity;

		}
			

		if ( material.lightMapIntensity != undefined );

			materialObject.lightMapOverrideIntensity = material.lightMapIntensity;

		if ( material.lightMapOverride && material.lightMap  ){

			materialObject.lightMapOverride = "lightmapoverride.jpg";
			materialObject.lightMapOverrideIntensity = material.lightMapIntensity;
			materialFile.file( "lightmapoverride." + material.lightMapOverrideExt, material.lightMapOverrideBinary, {binary: true} );
			ExportImage( material.lightMapOverride.image, 
				"lightmapoverride",
				materialFile,
				5 );

		}

		if (material.scale1 ) { // UV Scale 1
			materialObject.scale = material.scale1;
		}

		if ( material.map ){

			materialObject.diffuse = "diffuse.jpg";
			ExportImage( material.map.image, 
				"diffuse",
				materialFile,
				5 );

		}

		if ( material.specularMap ){

			materialObject.specularMap = "specularmap.jpg";
			ExportImage(  material.specularMap.image, 
				"specularmap",
				materialFile,
				5 );

		}

		if ( material.metalnessMap ){

			materialObject.metalnessMap = "metalnessmap.jpg";
			ExportImage( material.metalnessMap.image, 
				"metalnessmap",
				materialFile,
				5 );

		}

		if ( material.roughnessMap ){

			materialObject.roughnessMap = "roughnessmap.jpg";
			ExportImage( material.roughnessMap.image, 
				"roughnessmap",
				materialFile,
				1 );

		}

		if ( material.alphaMap ){

			materialObject.alphaMap = "alphamap.jpg";
			ExportImage( material.alphaMap.image, 
				"alphamap",
				materialFile,
				1 );

		}

		if ( material.normalMap ){

			materialObject.normalMap = "normalmap.jpg";
			ExportImage( material.normalMap.image, 
				"normalmap",
				materialFile,
				1 );

		}

		return materialObject;

	}

	//

	var config = editor.config;

	var container = new UI.Panel();
	container.setClass( 'menu' );

	var title = new UI.Panel();
	title.setClass( 'title' );
	title.setTextContent( 'File' );
	container.add( title );

	var options = new UI.Panel();
	options.setClass( 'options' );
	container.add( options );

	// New

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'New' );
	option.onClick( function () {

		if ( confirm( 'Any unsaved data will be lost. Are you sure?' ) ) {

			editor.clear();

		}

	} );
	options.add( option );

	//

	options.add( new UI.HorizontalRule() );

	// Import

	var form = document.createElement( 'form' );
	form.style.display = 'none';
	document.body.appendChild( form );

	var fileInput = document.createElement( 'input' );
	fileInput.type = 'file';
	fileInput.addEventListener( 'change', function ( event ) {

		editor.loader.loadFile( fileInput.files );
		form.reset();

	} );
	form.appendChild( fileInput );

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Import' );
	option.onClick( function () {

		fileInput.click();

	} );
	options.add( option );

	//

	options.add( new UI.HorizontalRule() );

	// Export Material

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export Material' );
	option.onClick( function () {

		var object = editor.selected;

		if ( object === null ) {

			alert( 'No object selected.' );
			return;

		}

		var material = object.material;

		if ( material === undefined ) {

			alert( 'The selected object doesn\'t have a material.' );
			return;

		}

		ExportMaterial("material");

	} );
	options.add( option );

	// Export Geometry

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export Geometry' );
	option.onClick( function () {

		var object = editor.selected;

		if ( object === null ) {

			alert( 'No object selected.' );
			return;

		}

		var geometry = object.geometry;

		if ( geometry === undefined ) {

			alert( 'The selected object doesn\'t have geometry.' );
			return;

		}

		var output = geometry.toJSON();

		try {

			output = JSON.stringify( output, parseNumber, '\t' );
			output = output.replace( /[\n\t]+([\d\.e\-\[\]]+)/g, '$1' );

		} catch ( e ) {

			output = JSON.stringify( output );

		}

		saveString( output, 'geometry.json' );

	} );
	options.add( option );

	// Export Object

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export Object' );
	option.onClick( function () {

		var object = editor.selected;

		if ( object === null ) {

			alert( 'No object selected' );
			return;

		}

		var output = object.toJSON();

		try {

			output = JSON.stringify( output, parseNumber, '\t' );
			output = output.replace( /[\n\t]+([\d\.e\-\[\]]+)/g, '$1' );

		} catch ( e ) {

			output = JSON.stringify( output );

		}

		saveString( output, 'model.json' );

	} );
	options.add( option );

	// Export Scene

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export Scene' );
	option.onClick( function () {

		var output = editor.scene.toJSON();

		try {

			output = JSON.stringify( output, parseNumber, '\t' );
			output = output.replace( /[\n\t]+([\d\.e\-\[\]]+)/g, '$1' );

		} catch ( e ) {

			output = JSON.stringify( output );

		}

		saveString( output, 'scene.json' );

	} );
	options.add( option );

	//

	options.add( new UI.HorizontalRule() );

	// Export GLB

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export GLB' );
	option.onClick( function () {

		var exporter = new THREE.GLTFExporter();

		exporter.parse( editor.scene, function ( result ) {

			saveArrayBuffer( result, 'scene.glb' );

			// forceIndices: true, forcePowerOfTwoTextures: true
			// to allow compatibility with facebook
		}, { binary: true, forceIndices: true, forcePowerOfTwoTextures: true } );
		
	} );
	options.add( option );

	// Export pikcells

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export PIKCELLS' );
	option.onClick( function () {

		var exporter = new THREE.PIKCELLSExporter();
		var parsed = exporter.parse(editor.scene);

		// for (var i=0; i<object.geometries.length; i++){

		// 	var a = document.createElement("a");
		// 	document.body.appendChild(a);
		// 	a.style = "display: none";
		// 	var blob = new Blob(object.geometries[i], {type: "octet/stream"}),
		// 	url = window.URL.createObjectURL(blob);
		// 	a.href = url;
		// 	a.download = "bin" + i + ".bin";
		// 	a.click();
		// 	window.URL.revokeObjectURL(url);

		// }
		saveString( JSON.stringify(parsed), 'scene.pikcells' );
		
	} );
	options.add( option );

	// Export GLTF

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export GLTF' );
	option.onClick( function () {

		var exporter = new THREE.GLTFExporter();

		exporter.parse( editor.scene, function ( result ) {

			saveString( JSON.stringify( result, null, 2 ), 'scene.gltf' );

		} );


	} );
	options.add( option );

	// Export OBJ

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export OBJ' );
	option.onClick( function () {

		var object = editor.selected;

		if ( object === null ) {

			alert( 'No object selected.' );
			return;

		}

		var exporter = new THREE.OBJExporter();

		saveString( exporter.parse( object ), 'model.obj' );

	} );
	options.add( option );

	// Export STL

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Export STL' );
	option.onClick( function () {

		var exporter = new THREE.STLExporter();

		saveString( exporter.parse( editor.scene ), 'model.stl' );

	} );
	options.add( option );

	//

	options.add( new UI.HorizontalRule() );

	// Publish

	var option = new UI.Row();
	option.setClass( 'option' );
	option.setTextContent( 'Publish' );
	option.onClick( function () {

		var zip = new JSZip();

		//

		var output = editor.toJSON();
		output.metadata.type = 'App';
		delete output.history;

		var vr = output.project.vr;

		output = JSON.stringify( output, parseNumber, '\t' );
		output = output.replace( /[\n\t]+([\d\.e\-\[\]]+)/g, '$1' );

		zip.file( 'app.json', output );

		//

		var title = config.getKey( 'project/title' );

		var manager = new THREE.LoadingManager( function () {

			save( zip.generate( { type: 'blob' } ), ( title !== '' ? title : 'untitled' ) + '.zip' );

		} );

		var loader = new THREE.FileLoader( manager );
		loader.load( 'js/libs/app/index.html', function ( content ) {

			content = content.replace( '<!-- title -->', title );

			var includes = [];

			if ( vr ) {

				includes.push( '<script src="js/WebVR.js"></script>' );

			}

			content = content.replace( '<!-- includes -->', includes.join( '\n\t\t' ) );

			var editButton = '';

			if ( config.getKey( 'project/editable' ) ) {

				editButton = [
					'',
					'			var button = document.createElement( \'a\' );',
					'			button.href = \'https://threejs.org/editor/#file=\' + location.href.split( \'/\' ).slice( 0, - 1 ).join( \'/\' ) + \'/app.json\';',
					'			button.style.cssText = \'position: absolute; bottom: 20px; right: 20px; padding: 12px 14px; color: #fff; border: 1px solid #fff; border-radius: 4px; text-decoration: none;\';',
					'			button.target = \'_blank\';',
					'			button.textContent = \'EDIT\';',
					'			document.body.appendChild( button );',
					''
				].join( '\n' );
			}

			content = content.replace( '\n\t\t\t/* edit button */\n', editButton );

			zip.file( 'index.html', content );

		} );
		loader.load( 'js/libs/app.js', function ( content ) {

			zip.file( 'js/app.js', content );

		} );
		loader.load( '../build/three.min.js', function ( content ) {

			zip.file( 'js/three.min.js', content );

		} );

		if ( vr ) {

			loader.load( '../examples/js/vr/WebVR.js', function ( content ) {

				zip.file( 'js/WebVR.js', content );

			} );

		}

	} );
	options.add( option );

	//

	var link = document.createElement( 'a' );
	link.style.display = 'none';
	document.body.appendChild( link ); // Firefox workaround, see #6594

	function save( blob, filename ) {

		link.href = URL.createObjectURL( blob );
		link.download = filename || 'data.json';
		link.click();

		// URL.revokeObjectURL( url ); breaks Firefox...

	}

	function saveArrayBuffer( buffer, filename ) {

		save( new Blob( [ buffer ], { type: 'application/octet-stream' } ), filename );

	}

	function saveString( text, filename ) {

		save( new Blob( [ text ], { type: 'text/plain' } ), filename );

	}

	return container;

};
