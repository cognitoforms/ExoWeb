ECHO OFF
ECHO.
ECHO --Pre-Raking - START------------------------------
tf checkout dist\exoweb-msajax-nojquery.js
tf checkout dist\exoweb-msajax.js
tf checkout dist\jquery.exoweb-msajax.js
tf checkout dist\exoweb-mock.js
ECHO --Pre-Raking - COMPLETE---------------------------
ECHO.
ECHO.

ECHO --Checking for source file updates - START--------
tf get src /recursive
ECHO --Checking for source file updates - COMPLETE-----
ECHO.
ECHO ON