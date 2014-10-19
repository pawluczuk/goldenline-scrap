var sqlite3 = require('sqlite3').verbose();
var cheerio = require('cheerio');
var request = require('request');
var async = require('async-series');
var db = new sqlite3.Database('goldenline');

var charCodeRange = {
	start: 97,
	end: 122
};
var mapurl = 'http://www.goldenline.pl/profile/mapa/';

function saveProfiles(letter, numOfPages) {
	db.serialize(function() {
		console.log("preparing letter " + letter);
		var stmt = db.prepare("INSERT INTO hyperlinks VALUES (?, NULL, 0)");
		var functions = [];
		for (var i = 1; i <= numOfPages; i++)
		{
			var url = mapurl + letter + '/s/' + i;

			functions.push(function(callback){
				request(url, (function(i) {
					return function(err, resp, html) {
						if (err) console.log(err);
						var $ = cheerio.load(html);
						var profileUrls = $('div#people a[href]').map(function(t,a) { return a.attribs.href; }).toArray();
						profileUrls.forEach(function(el) {
							stmt.run(el);
						});
						callback();
					};
				})(i));
			});

			async(functions, function() {
				console.log("finalized page within letter " + letter);
				if (letter === 'z') stmt.finalize();
			});
		}
	});
}

function start() {
	var functions = [];
	for (var cc = charCodeRange.start; cc <= charCodeRange.end; cc++) {
		var letter = String.fromCharCode(cc);
		var validurl = mapurl + letter;
		
		(function(cc) {
			functions.push(function(callback) {
				request(validurl, (function(cc) 
				{
					if (String.fromCharCode(cc) === 'q') saveProfiles(String.fromCharCode(cc), 1);
					return function(err, resp, html) {
						var $ = cheerio.load(html);
						var last = $('ul.pager:not(#contactLetters) a[href]:not(.next)').last();
						
				 		last.filter(function() {
							var data = $(this);
							numOfPages = Number(data.text());
							saveProfiles(String.fromCharCode(cc), numOfPages);
						});
						callback();
					};
				})(cc));
			});

			async(functions, function() {
				console.log("finalized letter " + String.fromCharCode(cc));
				if (String.fromCharCode(cc) === 'z') {
					console.log("end");
					db.close();
				}
			});
		})(cc);
	}
}

start();
/**/