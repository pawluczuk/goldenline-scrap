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

function processOnePage(letter, pagenumber, stmt) {
	return function(callback) {
		console.log('Processing letter ' + letter + '\tpage number ' + pagenumber);
		var url = mapurl + letter + '/s/' + pagenumber;
		request(url, function(err, resp, html) {
			var $ = cheerio.load(html);
			var profileUrls = $('div#people a[href]').map(function(t,a) { return a.attribs.href; }).toArray();
			profileUrls.forEach(function(link) {
				stmt.run(link);
			});
			callback();
		});
	};
}

function procesLetterPages(letter, numOfPages, callback) {
	var functions = [];
	var stmt = db.prepare("INSERT INTO hyperlinks VALUES (?, NULL, 0)");
	for (var i = 1; i <= numOfPages; i++)
	{
		functions.push(processOnePage(letter, i, stmt));
	}
	async(functions, function(){
		console.log('Finalized letter ' + letter);
		stmt.finalize(function() {
			callback();
		});
	});	
}

function numberOfPages(html) {
	var $ = cheerio.load(html);
	var last = $('ul.pager:not(#contactLetters) a[href]:not(.next)').last();
	return (Number(last.text()) === 0) ? 1 : Number(last.text());
}

function processLetter(letter) {
	return function(callback) {
		var validurl = mapurl + letter;
		request(validurl, function(err, resp, html) {
			var numOfPages = numberOfPages(html);
			console.log('Starting letter ' + letter + '\t with no of pages ' + numOfPages + '...');
			procesLetterPages(letter, numOfPages, function() {
				callback();
			});
		});
	};
}

function start() {
	var functions = [];
	for (var cc = charCodeRange.start; cc <= charCodeRange.end; cc++) {
		functions.push(processLetter(String.fromCharCode(cc)));
	}
	async(functions, function() {
		console.log('Finished downloading public profile hyperlinks.');
		db.close();
	});
}

start();
/**/