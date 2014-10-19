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

function getOneLetterPage(letter, numOfPages) {
	db.serialize(function() {
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
		}
		async(functions, function() {
			console.log("finalized page within letter " + letter);
			stmt.finalize();
		});
	});
}

function numberOfPages(html) {
	var $ = cheerio.load(html);
	var last = $('ul.pager:not(#contactLetters) a[href]:not(.next)').last();
	console.log(Number(last.text()));
	if (!last) return 1;
	else return Number(last.text());
}

function start() {
	var functions = [];
	for (var cc = charCodeRange.start; cc <= charCodeRange.end; cc++) {
		var validurl = mapurl + String.fromCharCode(cc);
		functions.push(function(callback) {
			request(validurl, function(err, resp, html) {
				var numOfPages = numberOfPages(html);
				//getOneLetterPage(String.fromCharCode(cc), numOfPages);
				console.log("letter " + String.fromCharCode(cc) + "\tno" + numberOfPages);
				callback();
			});
		});
	}
	async(functions, function() {
		db.close();
	});
}

start();
/**/