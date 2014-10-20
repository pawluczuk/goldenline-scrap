goldenline-scrap
================

Node.js application for getting content of goldenline profiles

Two scripts:
* 'get-hyperlinks.js' retrieves hyperlinks to all public profiles on goldenline from profile's map (http://www.goldenline.pl/profile/mapa/a) and stores it in goldenline sqlite3 database (table 'hyperlinks')
* 'get-profiles.js' retrieves each profile from 'hyperlinks' table and stores its content in 'users' table