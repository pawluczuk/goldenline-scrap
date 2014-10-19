var sqlite3 = require('sqlite3').verbose();
var cheerio = require('cheerio');
var request = require('request');
var db = new sqlite3.Database('goldenline');

var charCodeRange = {
	start: 97,
	end: 122
};
var mapurl = 'http://www.goldenline.pl/profile/mapa/';

function saveProfiles(letter, numOfPages) {
	db.serialize(function() {
		var stmt = db.prepare("INSERT INTO hyperlinks VALUES (?, NULL, 0)");
		for (var i = 1; i <= numOfPages; i++)
		{
			var url = mapurl + letter + '/s/' + i;
			request(url, (function(i) {
				return function(err, resp, html) {
					if (err) console.log(err);
					var $ = cheerio.load(html);
					var profileUrl = $('div#people a[href]').attr('href');
					stmt.run(profileUrl);
					if (++i > numOfPages) stmt.finalize();
				};
			})(i));
		}
	});
	db.close();
}

function start() {
	for (var cc = charCodeRange.start; cc <= charCodeRange.start; cc++) {
		var letter = String.fromCharCode(cc);
		var validurl = mapurl + letter;
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
			};
		})(cc));
	}
}

start();
/**/