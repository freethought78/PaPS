	var _clipboard;
	var backgroundColor;
	var canvas;
	var zoom;
	var stage;
	var menu = document.getElementById("menu");
	var gamedefinitionurl = "test.txt";
	var backgroundColorSelector;
	var keys;
	var serverConnection;
	var username;
	var p;
	var chathistory ="";
	var gamehistory = [];
	var currenthistoryposition = 0;
	
	actingServer = "none";

	// on the server, we store an array of connections to all of the connected peers.
	// non server peers will not use this array.
	connections = [];

	// a list of the names of connected clients
	var peerList = [];

	// keeps track of whether the engine has been started so we dont start it again every time a new connection is made to the server
	var engineStarted = false;
	
	// code begins executing here when page loads
	$(function(){
		createMainMenu();
	})
	

//new code starts here
function post(data){
	chathistory += "<br>"+data
	$("#chatoutput").html(chathistory);
}

function synchronizeScenes(){
	if (serverID!="disconnected"){
		window.requestAnimationFrame(function(){
			var statePacket = createStatePacket();
			broadcast(statePacket);
		})
	}
}

function createStatePacket(){
	var statePacket = {type: "state", state:JSON.stringify(canvas)};
	return statePacket;
}

// If this is the acting server loop through the list of connections in reverse, eliminating dead connections from the list
// then broadcast the updated list to the clients
function removeDeadConnections(){
	if(actingServer == true){
		for (var currentPeer = connections.length -1; currentPeer>=0; currentPeer--){
			if(connections[currentPeer].connection.open == false){
				var name = connections[currentPeer].name;
				var id = connections[currentPeer].id;
				var disconnectPacket = {type: "droppedConnection", name: name, peerID: id};
				post("-----"+name+" left the server-----");
				broadcast(disconnectPacket);
				connections.splice(currentPeer, 1);
			}
		}
		updateRemotePeerLists();
	}
}

function updateRemotePeerLists(){
	peerList = [];
	peerList.push(username);
	for (var currentPeer in connections){
		peerList.push(connections[currentPeer].name);
	}
	for (var currentPeer in connections){
		connections[currentPeer].connection.send(JSON.stringify({type: "peerListUpdate", list: JSON.stringify(peerList)}));
	}
	updateLocalPeerList(peerList);
}

function updateLocalPeerList(){
	var userlistcontents = "<center>Players:<br><hr>";
	for(var currentName in peerList){
		userlistcontents+=peerList[currentName]+"<BR>";
	}
	userlistcontents+="</center>";
	$("#userlist").html(userlistcontents);
}

//rebroadcast state changes to all clients except the sender
function rebroadcast(packet){
	if(actingServer == true){
		for(var currentPeer in connections){
			connections[currentPeer].connection.send(packet);
		}
	}
}

function broadcast(packet){
	if (actingServer == false){
		p.send(JSON.stringify(packet));
	}else{
		if (packet.type != "connection"){
			rebroadcast(JSON.stringify(packet));
		}
	}
}

function createMainMenu(){
	$("body").html(
		'<button style="position:absolute; background-color:green" onclick="startSinglePlayer()">Single Player</button>'+
		'<center>'+
		'<div id="pageContent">'+
		'<div style="background-color: #57B; color: #222;"><span style="font-size:3em;">PaPS</span><br>'+
		'Print and Play Simulator</div><br>'+
		'Your Nickname:<br>'+
		'<div id="nameInputDiv">'+
		'<input id="nameInput"><br>'+
		'<button onclick="addConnectionDetails()">Submit Name</button>'+
		'</div>'+
		'<br><br>'+
		'</div>'+
		'</center>'
	);
	$("body").css("margin", 0);
	
	//Enter pressed inside nickname input is the same as pressing the submit button
	$("#nameInput").on('keyup', function (e) {
		if (e.keyCode == 13) {
			addConnectionDetails();
		}
	});
}

//add connection details to page
function addConnectionDetails(){
	if(validateName()==false){
	} else {
		//Replace name input with a static representation of users name	
		replaceNameInput();
		
		addHostOrJoinControls();
	}
	
	//pressing enter on the target ID input will do the same as pressing connect
	$("#targetIDinput").on('keyup', function (e) {
    if (e.keyCode == 13) {
        connect();
    }
});
}

function addHostOrJoinControls(){
	var controlscode = '<div id="connectbuttons"><button onclick=connect("server")>Host Game</button>' +
	'<button onclick=connect("client")>Join Game</button></div>'
	$("#pageContent").append(controlscode);
}

function connect(connectiontype){
	$("#connectbuttons").remove();
	
	var connectioncells = '<center><div id="leftcell" style="float:left; width:50%"></div>';
	connectioncells += '<div id="rightcell" style="float:right; width:50%"></div></center>';
	
	if (connectiontype == "server"){
		actingServer = true;
		var serverhint = document.createElement("div");
		$(serverhint).html("send this code to your friends,<BR>")
		$(serverhint).append("wait for their response <br>and paste what they send back below");
		$("#pageContent").append(serverhint);
		
		$("body").append(connectioncells)

		var outgoing = document.createElement("pre");
		$(outgoing).attr("id", "outgoing");
		$("#leftcell").append(outgoing);
			
		var incoming = document.createElement("textarea");
		$(incoming).attr("id", "incoming");
		$("#rightcell").append(incoming);
		
	}else{
		actingServer = false;
		var serverhint = document.createElement("div");
		$(serverhint).html("tell your friend to start a room<BR>")
		$(serverhint).append("wait for them to send you their code<BR>");
		$(serverhint).append("paste it in the box below, click the button, and give your friend the response");
		$("#pageContent").append(serverhint);
		
		$("#pageContent").append(connectioncells)
		
		var incoming = document.createElement("textarea");
		$(incoming).attr("id", "incoming");
		$("#leftcell").append(incoming);
		
		var outgoing = document.createElement("pre");
		$(outgoing).attr("id", "outgoing");
		$("#rightcell").append(outgoing);
	}
	
	$(outgoing).css({
		"width": "100%",
		"word-wrap": "break-word",
		"white-space": "normal"
	});
	
	$(incoming).css({
		"width": "100%",
		"height": "100%"
	});			

	
	var submitbutton = document.createElement("button");
	$(submitbutton).click(function(){submitrequest()});
	$(submitbutton).html("Submit");
	$(submitbutton).attr("id", "submitbutton");
	$("#pageContent").append(submitbutton);
	
	p = new SimplePeer({
		initiator: actingServer,
		trickle: false
	})

	p.on('error', function(err){console.log('error', err)})

	p.on('signal', function(data){
		console.log('SIGNAL', JSON.stringify(data))
		$('#outgoing').html(JSON.stringify(data));
	})


	p.on('connect', function(){
		console.log('CONNECT')
		p.send(JSON.stringify(createConnectionPacket()));
		

	})

	p.on('data', function(data){
		console.log('data: ' + data)
		interpretNetworkData(data);
	})
	

}

function createConnectionPacket(){
	var data = {type: "connection", name: username};
	return data;
}

function interpretNetworkData(data){
	//console.log(data);
	data=JSON.parse(data);
//alert the console when network traffic is recieved
	if(data.type == "connection"){
		remoteName = data.name;
		
		//Start the 2d engine and load the scene using method from external file js/startengine.js
		if (engineStarted == false){
			serverID = "connected";
			firstRun();
			engineStarted = true;
			//registerEnterKey(conn);
		}
		
		
		//notify user that a connection was established
		if (actingServer==true){
			post("-----Incoming Connection from "+remoteName+"-----");
		} else {
			post ("-----Connected to "+remoteName+"'s server-----");
		}
		
		// Sychronize scenes between peers
		synchronizeScenes();
		
		if (actingServer == true){
			connections.push({name: remoteName, connection:p});
			updateRemotePeerLists();
		}
	}

	//when a chat message is recieved, post it to the output
	if(data.type == "chat"){
		var sender = data.user;
		var message = data.message;
		post(sender + ": " + message);
		$("#chatcontainer").css({"background-color": "orange"});

	}

	//when a state message is recieved, update all pieces on the board
	if(data.type == 'state'){
		gamehistory.push(data.state);
		currenthistoryposition = gamehistory.length - 1;
		colorHistoryButtons();
		loadGame(data.state);
		window.requestAnimationFrame(function(){
			addKeyListener();	
		})
		
	}

	// this packet is set from the server containing a list of connected peers
	if(data.type == 'peerListUpdate'){
		peerList = JSON.parse(data.list);
		updateLocalPeerList();
	}

	// A connect packet is sent from the server to the clien list when a new client has connected to the server
	if(data.type=="connect"){
		post("-----"+data.name+" connected to the server-----");
	}

	// A droppedConnection packet is sent from the server to the client list when a client has lost connections
	if(data.type=='droppedConnection'){
		post("-----"+data.name+" left the server-----");
	}
}
	 
function submitrequest(){
	$("#submitbutton").remove();
	p.signal(JSON.parse(document.querySelector('#incoming').value))
}

function validateName(){
	if($("#nameInput").val() == ""){
		return false;
	}else{
		return true;
	}
}

function replaceNameInput(){
	//stores the users name after being validated
	username = $("#nameInput").val();
	$("#nameInputDiv").html(username);
}

function startSinglePlayer(){
	serverID="disconnected";
	firstRun();
}
//new code ends here

function firstRun(){
	//Custom Key Detection
	keys = {};
	window.onkeyup = function(e) { keys[e.keyCode] = false; }
	window.onkeydown = function(e) { keys[e.keyCode] = true; }
	
	//replace contents of body with ingame view
	var body = '<input id="inputfiledialog" type="file" style="position: fixed; top: -100em">'+
	'<div id="menu" style="position: absolute; top: 0; left: 0; z-index: 1;"></div>';
	$("body").css({
		'margin': 0,
		'overflow': "hidden"
	});
	
	$("body").html(body);
	
	if(serverID != "disconnected"){
		addChat();
		addUserList();
	}
	
	initialize();
}

function addUserList(){
	//create user list window
	$("#userlist").remove();
	var userlist = document.createElement("div");
	$(userlist).attr("id", "userlist");
	
	$(userlist).css({
		"position": "absolute",
		"left": $(window).width() - 10,
		"top": 0,
		"z-index": 1,
		"color": "white",
		"background-color": "black",
		"opacity": 0.5,
		"height": "50%",
		"width": 200,
		"padding": "5px"
	});
	
	$(userlist).click(function(){
		//$(chatcontainer).css("top", "");
		$(userlist).animate({left: $(window).width() - $(userlist).width()-10}, 200);
	});
	
	$(userlist).mouseleave(function(){
		//$(chatcontainer).css("bottom", "");
		$(userlist).animate({left: $(window).width() - 10}, 200);
	});
	
	$(userlist).html("<center>Users:<BR><HR></center>");
	document.body.appendChild(userlist);
	updateLocalPeerList();
}

function addChat(){
	$("#chatcontainer").remove();
	//create chat window
	var chatcontainer = document.createElement("div");
	var chatoutput = document.createElement("div");
	var chatinput = document.createElement("textarea");
	
	$(chatcontainer).attr("id", "chatcontainer");
	$(chatoutput).attr("id", "chatoutput");
	$(chatinput).attr("id", "chatinput");
	
	$(chatcontainer).css({
		"position": "absolute",
		//"bottom": "0px",
		"top": $(window).height() - 5,
		"z-index": 1,
		"color": "white",
		"background-color": "black",
		"opacity": 0.5,
		"height": "200px",
		"width": $(window).width() - 10,
		"padding": "5px"
	});
	
	$(chatoutput).css({
		"height": "180px"
	});
	
	$(chatinput).css({
		"height": "20px",
		"background-color": "white",
		"color": "black",
		"width": "100%",
		"resize": "none"
	});
	
	$(chatinput).keyup(function(){
		var key = window.event.keyCode;

		// If the user has pressed enter
		if (key === 13) {
			// send the chat message
			var message = $(chatinput).val();
			post(username+": "+message);
			sendChatMessage(message);
			$(chatinput).val("");
		}
	});
	
	$(chatcontainer).click(function(){
		$(chatcontainer).css({"background-color": "black"});
		$(chatcontainer).animate({
			top: $(window).height() - $(chatcontainer).height()-10}, 200, "linear", function(){
			$(chatinput).focus();
		});
	});
	
	$(chatcontainer).mouseleave(function(){
		//$(chatcontainer).css("bottom", "");
		$(chatcontainer).animate({top: $(window).height() - 5}, 200);
		$(chatinput).blur();
	});
	
	
	//light up chat when message recieved 
	

	chatcontainer.appendChild(chatoutput);
	chatcontainer.appendChild(chatinput);
	document.body.appendChild(chatcontainer);
	
	$("#chatoutput").html(chathistory);
}

function sendChatMessage(message){
	var chatPacket = {type: "chat", message: message, user: username};
	broadcast(chatPacket);
}
	
function initialize(){
	backgroundColor = "#66ffff";
	canvas = createCanvas();
	zoom = 1;

	addZoomListener();
	addWindowResizeListener();
	addFileLoadListener();
	
	addCanvasEventListeners();
			
	canvas.setZoom(zoom);
	
	createMenu();	
	
	stage = document.getElementById("c");

	menu = document.getElementById("menu");
	gamedefinitionurl = "test.txt";
	
	backgroundColorSelector = document.getElementById("colorpicker");
	
	setBackgroundColor();
}

function addFileLoadListener(){
	$('input[type="file"]').change(function(e){
        var fileName = e.target.files[0];
        loadFile(fileName);
		$("#inputfiledialog").val("");
    });
}

function addCanvasEventListeners(){
	// whenever the canvas is modified, synchronize it across the network
	//canvas.on('object:added', synchronizeScenes);
	//canvas.on('object:removed', synchronizeScenes);
	//canvas.on('object:modified', synchronizeScenes);
	canvas.on('mouse:up', addCurrentStateToHistoryandSync);
	//$(".canvas-container").onmouseup = function(){addCurrentStateToHistoryandSync()};
	//addKeyListener();
}

function addCurrentStateToHistoryandSync(){
	window.requestAnimationFrame(function(){
		
		var newdata = JSON.stringify(canvas);
		var olddata = gamehistory[currenthistoryposition]
		if ((newdata != olddata) /*&& (currenthistoryposition == gamehistory.length -2)*/){
			gamehistory.push(newdata);
			currenthistoryposition = gamehistory.length - 1;
			colorHistoryButtons();
			synchronizeScenes();
		}
	});
}


function loadScript(url, callback)
{
    // Adding the script tag to the head as suggested before
    var head = document.head;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;

    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    script.onreadystatechange = callback;
    script.onload = callback;

    // Fire the loading
    head.appendChild(script);
}

	
function addWindowResizeListener(){
	$(window).resize(function(){
		var contents = JSON.stringify(canvas);
		$(".canvas-container").remove();
		
		canvas = createCanvas();
		
		loadGame(contents);

		setBackgroundColor();
		
		addCanvasEventListeners();
		
		addChat();
		
		addUserList();

	});
}

function createCanvas(){
	var height = $(window).height();
	var width = $(window).width();

	var canvascode = "<canvas id='c' width='"+width+"' height='"+height+"'></canvas>";

	$("body").append(canvascode);
	var canvas = new fabric.Canvas('c');

	canvas.setDimensions({
		width: "100%",
		height: "100%"
	},{
		cssOnly: true
	});
	
	stage = document.getElementById("c");

	return(canvas);
}

function submitcard(url){
	if (url==null){
		url = document.getElementById("cardurl").value;
	}
	fabric.Image.fromURL(url, function(img) {
	  img.scale(0.3);
	  canvas.add(img).setActiveObject(img);
	});
	createMenu();
}


function addZoomListener(){
	canvas.on('mouse:wheel', function(opt) {
	var delta = opt.e.deltaY;
	zoom = canvas.getZoom();
	zoom = zoom + delta/200;
	if (zoom > 20) zoom = 20;
	if (zoom < 0.01) zoom = 0.01;
	canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
	opt.e.preventDefault();
	opt.e.stopPropagation();
	constrainViewport();
});
	  
	  
	  

	
	addKeyListener();
}

function keyListener(e) {
	zoom = canvas.getZoom();
	var sensitivity = 0.01;
	var adjusted = false;
	if (e.which == 114){
		zoom+=sensitivity;
		adjusted = true;
	}
	if (e.which == 102){	
		zoom-=sensitivity;
		adjusted = true;
	}
	if (e.which == 97){
		canvas.relativePan(new fabric.Point(10, 0));
		adjusted = true;
	}
	if(e.which == 100){
		canvas.relativePan(new fabric.Point(-10, 0));
		adjusted = true;
	}
	if (e.which == 119){
		canvas.relativePan(new fabric.Point(0, 10));
		adjusted = true;
	}
	if(e.which == 115){
		canvas.relativePan(new fabric.Point(0, -10));
		adjusted = true;
	}		
	if (adjusted == true){
		constrainZoom();
		constrainViewport();
		canvas.setZoom(zoom);
		
	};
}
	
function addKeyListener(){
	$(document).keypress(function(e){
		zoom = canvas.getZoom();
		var sensitivity = 0.01;
		var adjusted = false;
		if (e.which == 114){
			zoom+=sensitivity;
			adjusted = true;
		}
		if (e.which == 102){	
			zoom-=sensitivity;
			adjusted = true;
		}
		if (e.which == 97){
			canvas.relativePan(new fabric.Point(10, 0));
			adjusted = true;
		}
		if(e.which == 100){
			canvas.relativePan(new fabric.Point(-10, 0));
			adjusted = true;
		}
		if (e.which == 119){
			canvas.relativePan(new fabric.Point(0, 10));
			adjusted = true;
		}
		if(e.which == 115){
			canvas.relativePan(new fabric.Point(0, -10));
			adjusted = true;
		}		
		if (adjusted == true){
			constrainZoom();
			constrainViewport();
			canvas.setZoom(zoom);	
		}
	});
}
function constrainZoom(){
	if (zoom > 20) zoom = 20;
	if (zoom < 0.01) zoom = 0.01;
}

function constrainViewport(){
	var vpt = canvas.viewportTransform;

	
	if (zoom < 400 / 1000) {
		vpt[4] = 200 - 1000 * zoom / 2;
		vpt[5] = 200 - 1000 * zoom / 2;
	} else {
		if (vpt[4] >= 0) {
			vpt[4] = 0;
		} else if (vpt[4] < canvas.getWidth() - 1000 * zoom) {
			vpt[4] = canvas.getWidth() - 1000 * zoom;
		}
		if (vpt[5] >= 0) {
			vpt[5] = 0;
		} else if (vpt[5] < canvas.getHeight() - 1000 * zoom) {
			vpt[5] = canvas.getHeight() - 1000 * zoom;
		}
	}
}	

function createMenu(){
	var menucode = '<button onclick = "addcard();">Add Card</button>'+
	'<button onclick = "cloneSelected();">Clone</button>'+
	'<button onclick = "deleteSelected();">Delete</button>'+
	'<button onclick = "saveGame()">Save Game</button>'+
	'<button onclick = "openfiledialog();">Load Game</button>'+
	'<button id = "historyStart" onclick = "historyStart()" style="background:gray"><<</button>'+
	'<button id = "historyBack" onclick = "historyBack()" style="background:gray"><</button>'+
	'<button id = "historyForward" onclick = "historyForward()" style="background:gray">></button>'+
	'<button id = "historyEnd" onclick = "historyEnd()" style="background:gray">>></button>'+
	'<input type="color" id="colorpicker" onchange="setBackgroundColor()" value="'+backgroundColor+'">';
	
	$("#menu").html(menucode);
	backgroundColorSelector = document.getElementById("colorpicker");
}

function historyStart(){
	currenthistoryposition = 0;
	loadHistory(currenthistoryposition);
	colorHistoryButtons();
}

function historyBack(){
	currenthistoryposition --;
	if(currenthistoryposition <= 0){
		currenthistoryposition = 0;
	}
	colorHistoryButtons();
	loadHistory(currenthistoryposition);
	
}

function historyForward(){
	var maxhistoryposition = gamehistory.length -1;
	currenthistoryposition ++;
	if(currenthistoryposition >= maxhistoryposition){
		currenthistoryposition = maxhistoryposition;
	}
	colorHistoryButtons();
	loadHistory(currenthistoryposition);
	
}

function historyEnd(){
	currenthistoryposition = gamehistory.length - 1;
	loadHistory(currenthistoryposition);
	colorHistoryButtons()
}

function colorHistoryButtons(){
	if (currenthistoryposition == 0 ){
		$("#historyStart").css({"background-color": "gray"})
		$("#historyBack").css({"background-color": "gray"})
	}else{
		$("#historyBack").css({"background-color": "green"})
		$("#historyStart").css({"background-color": "green"})
	}
	if (currenthistoryposition == gamehistory.length - 1){
		$("#historyForward").css({"background-color": "gray"})
		$("#historyEnd").css({"background-color": "gray"})
	}else{
		$("#historyForward").css({"background-color": "green"})
		$("#historyEnd").css({"background-color": "green"})
	}
	if (currenthistoryposition < gamehistory.length - 1 && currenthistoryposition >0){
		$("#historyStart").css({"background-color": "green"})
		$("#historyBack").css({"background-color": "green"})
		$("#historyForward").css({"background-color": "green"})
		$("#historyEnd").css({"background-color": "green"})
	}
}

function loadHistory(position){
	if(position != gamehistory.length -1){
		canvas.loadFromJSON(gamehistory[position], canvas.renderAll.bind(canvas), function(o, object) {
			object.set('selectable', false);
		})
	} else {
		loadGame(gamehistory[currenthistoryposition]);
	}
}

function openfiledialog(){
	$("#inputfiledialog").click();
}

function setBackgroundColor(){
	backgroundColor = backgroundColorSelector.value;
	var style = "position: absolute; left: 0; top: 0; z-index: 0; background-color:"+ backgroundColor;
	stage.setAttribute("style", style);
}

function deleteSelected(){
	canvas.remove(canvas.getActiveObject());
}

function saveGame(){
	state = JSON.stringify(canvas);
	download(state, "test.txt", "text");
}

function loadFile(fileToRead){
	var reader = new FileReader();
	var fileToRead = document.querySelector('input').files[0];
	reader.addEventListener("loadend", function() {
	   loadGame(reader.result);
	   window.requestAnimationFrame(function(){
		   addCurrentStateToHistoryandSync();
	   })
	});
	reader.readAsText(fileToRead);
}

function loadGame(inputJSON){
	canvas.loadFromJSON(inputJSON, function(){
		//canvas.renderAll.bind(canvas);
	});
}

function centerScene(){
	var group = new fabric.Group(canvas.getObjects())
	canvas.centerObject(group)
	group.setCoords()
	canvas.renderAll.bind(canvas);
}

function cloneSelected(){
	canvas.getActiveObject().clone(function(cloned) {
		Paste(cloned);
	});
}

function addcard(){
	menu.innerHTML += "<input id='cardurl'></input><button onclick = 'submitcard();'>Submit</button>";
}


function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

function Copy() {
	canvas.getActiveObject().clone(function(cloned) {
		_clipboard = cloned;
	});
}

function Paste(source) {
	if (source == null){source = _clipboard}
	// clone again, so you can do multiple copies.
	source.clone(function(clonedObj) {
		canvas.discardActiveObject();
		clonedObj.set({
			left: clonedObj.left + 10,
			top: clonedObj.top + 10,
			evented: true,
		});
		if (clonedObj.type === 'activeSelection') {
			// active selection needs a reference to the canvas.
			clonedObj.canvas = canvas;
			clonedObj.forEachObject(function(obj) {
				canvas.add(obj);
			});
			// this should solve the unselectability
			clonedObj.setCoords();
		} else {
			canvas.add(clonedObj);
		}
		source.top += 10;
		source.left += 10;
		canvas.setActiveObject(clonedObj);
		canvas.requestRenderAll();
	});
}