;(function() {
var md5fn // shortcut
	,files = []
	,hashes = [];
var rcrlf = /\r\n|\r|\n/; // splits text into lines regardless of system's line endings

// parses output of md5 file on the server into array where elem[1] is filename and elem[2] is hash
var mapMd5Files = function(md5strings) {
	var rfiles=/[^(]+\(([^)]+)\).+/;
	var rhashes=/.+ = (.+)/;
	var extractor = function(rexp) { return function(elem) {
		var res = rexp.exec(elem);
		return res ? res[1] : "error:"+elem;
	} }
	return {
		"hashes" : md5strings.map(extractor(rhashes)),
		"files": md5strings.map(extractor(rfiles))
	}
}

// just gets the md5 files. TODO: remove
var getMd5 = function(files, hashes) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/files.md5');
	xhr.onreadystatechange = function() {
		if (xhr.readyState === XMLHttpRequest.DONE) {
			console.log("md5 received");
			window.md5files = xhr.responseText;
		}
	}
	xhr.send();
}

var compareIntegrity = function(own, server) {
	window.ck = own.files.reduce(function(acc, ownFile, ownIndex){
		var ownHash = own.hashes[ownIndex];
		var serverIndex = server.files.indexOf(ownFile);
		if (serverIndex < 0) {
			acc.push("Not found file: " + ownFile + " hash " + ownHash);
		} else {
			var serverHash = server.hashes[serverIndex];
			if (serverHash != ownHash) {
				acc.push("Different version of file: " + ownFile + " own hash: " + ownHash + " server hash: " + serverHash);
			}
		}
		return acc;
	}, []);
}

// downloads and parses hashes
var downloadHashes = function(files, hashes, onDone) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'http://localhost/files.md5?'+Math.floor(Date.now())); // parameter to avoid cache
	xhr.onreadystatechange = function() {
		if (xhr.readyState === XMLHttpRequest.DONE) {
			console.log("md5 received");
			var lists = window.lg = xhr.responseText.split(rcrlf);
			onDone(mapMd5Files(lists));
			
		}
	}
	xhr.send();
}

// checks elements asynchronously
var elementHasher = function(arr, onDone, sum, index) {
	var sum = sum || []
		,index = index || 0
		,rFileName = /^.+\/\/[^\/]+\/([^&#;\\?]+).*/;
	if (index >= arr.length) { return onDone(sum); }
	
	var elem = arr[index];
	
	var cont = function(res) { setTimeout(function() { 
		// sum.push(res);
		hashes.push(res[1]);
		files.push(res[2]);
		// sum.push({status: res[0], hash: res[1], src: res[2]});
		elementHasher(arr, onDone, sum, index + 1);}, 50); 
	}

	if (elem.src == "" || (elem.src == null && elem.href == null)) {
		cont([200, md5fn(elem.innerText), "Inner"+index]);
	} else if (elem.src != null) {
		cont([200, "Skipped", elem.src]);
	} else {
		var pth = elem.src != null ? elem.src : elem.href;
		var xhr = new XMLHttpRequest();
		xhr.open('GET', pth);
		xhr.onreadystatechange = function() {
			if (xhr.readyState === XMLHttpRequest.DONE) {
				var subpth = rFileName.exec(pth);
			 	cont([xhr.status, md5fn(xhr.responseText), subpth ? subpth[1] : pth]);
			}
		}
		xhr.send();
	}
}

// when MD5 is available, let's do the check
var onMd5Load = function() {
	md5fn=Crypto.MD5; // Google's implementation
	var onDone = function(res) {window.cr = { "hashes": hashes, "files": files}; console.log(window.cr);}
	elementHasher(document.querySelectorAll("script[src], link[rel=stylesheet]"), onDone);
}

var head = document.head || document.getElementsByTagName('head')[0];
var md5src = "https://storage.googleapis.com/google-code-archive-downloads/v2/code.google.com/crypto-js/2.5.3-crypto-md5.js"; // 5.2kb compressed
if (!head.querySelector("script[src='" + md5src + "']")) {
	var script = document.createElement('script');
	script.setAttribute("type","text/javascript");
	script.setAttribute("src", md5src);
	script.addEventListener('load', onMd5Load, false);
	script.addEventListener('error', function() { console.error("Failed to load script " + script.src); }, false);
	head.appendChild(script);
} else {
	onMd5Load();
}
})();
