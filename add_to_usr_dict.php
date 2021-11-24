<?php
	/* adds a word to a users dictionary */
	define('DEPS_PATH', 		'/lib/macro.php'); 				// specify here the path to the file where the required PHP functions are stored
	define('USR_DICT_PATH', '/usr-dict/usr-dict.dic'); // relative path (from this dir) to the custom dictionary file

	require_once $_SERVER['DOCUMENT_ROOT'].DEPS_PATH;

	file_put_contents(__DIR__.USR_DICT_PATH, PHP_EOL.$_POST['word'], FILE_APPEND);
?>
