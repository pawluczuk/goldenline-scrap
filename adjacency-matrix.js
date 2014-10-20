var sqlite3 = require('sqlite3').verbose();
var cheerio = require('cheerio');
var request = require('request');
var async = require('async-series');
// test database with only chunk of files
var db = new sqlite3.Database('gl');

function saveAdjacencyMatrix(sourceId, hyperlinksArray, callback){
	var stmt = db.prepare("SELECT dataid FROM hyperlinks WHERE hyperlink = ?");
	for (var i = 0; i < hyperlinksArray.length; i++)
	{
		stmt.get(hyperlinksArray[i], function(err, row){
			if (row === undefined) console.log('not matched');
			else console.log(sourceId + '\t' + row);
			callback();
		});
	}
}

function processSingleContactPage(url, id, pageno) {
	return function(callback) {
		var contactsUrl = url + '/kontakty/s/' + pageno;
		request(contactsUrl, function(err, response, html) {
			var $ = cheerio.load(html);
			var profileUrls = $('td.user a[href]').map(function(t,a) { return a.attribs.href; }).toArray();
			saveAdjacencyMatrix(id, profileUrls, function() {
				callback();
			});
		});
	};
}

function processContactPages(url, id, numOfPages, callback) {
	var functions = [];
	for (var i = 1; i <= numOfPages; i++)
	{
		functions.push(processSingleContactPage(url, id, i)); 
	}
	async(functions, function(){
		console.log('Finalized profile with ID: ' + id);
		callback();
	});	
}

function numberOfPages(html){
	var $ = cheerio.load(html);
	var last = $('ul.pager:not(#contactLetters) a[href]:not(.next)').last();
	return (Number(last.text()) === 0) ? 1 : Number(last.text());
}

function retrieveFriends(url, id) {
	var contactsUrl = url + '/kontakty';
	return function(callback) {
		request(contactsUrl, function(err, response, html) {
			var numOfPages = numberOfPages(html);
			processContactPages(url, id, numOfPages, function() {
				console.log('Profile: ' + url + ' contacts has been parsed.');
				callback();
			});
		});
	};
}

function downloadChunk(chunk, callback) {
	functions = [];
	for (var i = 0; i < chunk.length; i++)
	{
		var url = chunk[i].hyperlink;
		var id = chunk[i].dataid;
		functions.push(retrieveFriends(url, id));
	}
	async(functions, function() {
		callback();
	});
}

function insertChunk(chunk, i) {
	return function(callback) {
		downloadChunk(chunk, function() {
			console.log('Parsed chunk of profiles: ' + i + '-' + (i + chunk.length));
			callback();
		});
	};
}

function start() {
	var stmt = db.prepare("SELECT hyperlink, dataid FROM hyperlinks WHERE downloaded = 1 limit 10");
	var counter = 0;
	stmt.all(function(err, rows) {
		console.log("Finished reading all hyperlinks.");
		functions = [];
		for (var i = 0; i < rows.length; i += 1000)
		{
			var chunk = rows.slice(i, Math.min(rows.length, i + 1000));
			functions.push(insertChunk(chunk, i));
		}
		async(functions, function() {
			db.close(function() {
				console.log("Creating adjacency matrix completed.");
			});
		});
	});
}

start();