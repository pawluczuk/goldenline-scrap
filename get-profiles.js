var sqlite3 = require('sqlite3').verbose();
var cheerio = require('cheerio');
var request = require('request');
var async = require('async-series');
var db = new sqlite3.Database('goldenline');

function parseData(html) {
	var $ = cheerio.load(html);
	var data = [];
	var sections = $('.details section').each(function(){
		var section = $(this).prevAll('.title').first().text().replace(/\s+/g, '');
		if (section === 'Podsumowanie') section = 'Praca';
		if (!$(this).hasClass('experience')) return true;
		if (!data[section]) data[section] = [];
		data[section] += $(this).text().replace(/\s+/g, ' ').replace('Zobacz pełny profil', '') + ';';
	});
	
	var dataid = $('.basicInfo').attr('data-id');
	var tags = $('.user-summary ul li').text().replace(/\s+/g, ' ');
	var summary = $('.user-summary .headline').text().replace(/\s+/g, ' ');
	var edu = (data['Edukacja'] === undefined) ? '' : data['Edukacja'];
	var work = (data['Praca'] === undefined) ? '' : data['Praca'];
	var friends = Number($('.usersList > h4').text().replace('Znajomi (', '').replace(')', ''));
	return {
				$dataid : dataid,
				$work : work,
				$edu : edu,
				$tags : tags,
				$summary : summary,
				$friends : friends
			};
}

function saveProfile(url, insert, update) {
	return function(callback) {
		request(url, function(err, response, html) {
			if (!err && response.statusCode == 200) {
				var obj = parseData(html);
				insert.run(obj, function() {
					update.run({ $dataid : obj.$dataid, $hyperlink : url}, function() {
						console.log('Ins: ' + obj.$dataid + ' Url: ' + url);
						callback();
					});
				});
			}
			else if (!err) {
				update.run({ $dataid : 0, $hyperlink : url}, function() {
					console.log('Not inserted: ' + url + '(not found or error).');
					callback();
				});
			}
		});
	};
}

function downloadChunk(chunk, callback) {
	var insert = db.prepare("INSERT INTO users VALUES ($dataid, $work, $edu, $tags, $summary, $friends)");
	var update = db.prepare("UPDATE hyperlinks SET downloaded = 1, dataid = $dataid WHERE hyperlink = $hyperlink");
	functions = [];
	for (var i = 0; i < chunk.length; i++)
	{
		var url = chunk[i].hyperlink;
		functions.push(saveProfile(url, insert, update));
	}
	async(functions, function() {
		insert.finalize(function() {
			update.finalize(function() {
				callback();
			});
		});
	});
}

function insertChunk(chunk, i) {
	return function(callback) {
		downloadChunk(chunk, function() {
			console.log('Saved chunk of profiles: ' + i + '-' + (i + 1000) + ' to database.');
			callback();
		});
	};
}

function start() {
	var stmt = db.prepare("SELECT hyperlink FROM hyperlinks WHERE downloaded = 0 limit 10000");
	var counter = 0;
	stmt.all(function(err, rows) {
		console.log("Finished reading all hyperlinks: " + rows.length);
		functions = [];
		for (var i = 0; i < rows.length; i += 1000)
		{
			var chunk = rows.slice(i, Math.min(rows.length, i + 1000));
			functions.push(insertChunk(chunk, i));
		}
		async(functions, function() {
			db.close(function() {
				console.log("Finished inserting all of the profiles successfully.");
			});
		});
	});
}

start();