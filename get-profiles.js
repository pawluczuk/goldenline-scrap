var sqlite3 = require('sqlite3').verbose();
var cheerio = require('cheerio');
var request = require('request');
var async = require('async-series');
var util = require('util');
var db = new sqlite3.Database('goldenline');

//  invalid
function saveProfileToDb(dataid, work, edu, tags, summary) {
	var insert = db.prepare("INSERT INTO users VALUES ($dataid, $work, $edu, $tags, $summary)", {
		$dataid : dataid,
		$work : work,
		$edu : edu,
		$tags : tags,
		$summary : summary
	});
	var update = db.prepare("UPDATE hyperlinks SET downloaded = 1 WHERE dataid = ?", dataid);
	insert.run(function() {
		//update.finalize();
	});
}
// invalid
function saveProfileFromURL(url) {
	request(url, function(err, resp, html) {
			var $ = cheerio.load(html);
			var tags = $('.user-summary ul li').text().replace(/\s+/g, ' ');
			var summary = $('.user-summary .headline').text().replace(/\s+/g, ' ');
			var data = [];
			var sections = $('.details section').each(function(){
				var section = $(this).prevAll('.title').first().text().replace(/\s+/g, '');
				if (section === 'Podsumowanie') section = 'Praca';
				if (!$(this).hasClass('experience')) return true;
				if (!data[section]) data[section] = [];
				data[section][data[section].length] = $(this).text().replace(/\s+/g, ' ').replace('Zobacz pełny profil', '');
			});
			saveProfileToDb(1, data['Praca'], data['Edukacja'], tags, summary);
		});
}

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
	return {
				$dataid : dataid,
				$work : work,
				$edu : edu,
				$tags : tags,
				$summary : summary
			}
}

function saveProfile(url, insert, update) {
	return function(callback) {
		request(url, function(err, response, html) {
			var obj = parseData(html);
			insert.run(obj, function() {
				update.run({ $dataid : obj.$dataid }, function() {
					console.log('Inserted: ' + obj.$dataid);
					callback();
				});
			})
		});
	};
}

function downloadChunk(chunk, callback) {
	var insert = db.prepare("INSERT INTO users VALUES ($dataid, $work, $edu, $tags, $summary)");
	var update = db.prepare("UPDATE hyperlinks SET downloaded = 1 WHERE dataid = $dataid");
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
			console.log('Downloaded chunk of profiles: ' + i + '-' + (i + 1000));
			callback();
		});
	};
}

function start() {
	var stmt = db.prepare("SELECT hyperlink, dataid FROM hyperlinks WHERE downloaded = 0");
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
				console.log("Finished inserting all of the profiles successfully.");
			});
		});
	});
	//if (counter++ % 1000 === 0) console.log(util.inspect(process.memoryUsage()) + ' \ncount: ' + counter);
}

start();