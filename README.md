# Ace Editor Spellcheck - MultiLang
This is a fork of the [original 'Ace Editor Spellcheck' plugin by Christopher Swenson](https://github.com/swenson/ace_spell_check_js)  
подробнее на русском (ссылка станет доступна после публикации статьи)
![Screenshot](screenshot.png)
## What's new:
0.1 (differences from the original plugin)
- Added the ability to use multiple dictionaries.
- Added support for characters other than Latin. However, in this regard, the **requirements for the freshness of the browser have increased greatly**. For most browsers releases of 2018 will go, for Firefox - 2020. Detail: https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/RegExp see compatibility table, line "Unicode property escapes (\p{...})").
	Reason: replacing part of regular expressions like /[^a-zA-Z\-']/ with /[^\p{Alpha}\-']/u. If you want to bring back support for older browsers, you can replace the new regex form with a more conservative but less versatile one: /[^a-zA-Zа-яА-Я\-']/ (example for Cyrillic character set).
- Added support for a users dictionary with the ability to add words to it. To add a word, call the add_to_usr_dict('desired_word') function. If no word is added check permissions for usr-dict.dic
- The plugin is designed as a class.
- Loading dictionaries no longer happens automatically, as large dictionaries cause a noticeable browser hangup. To download dictionaries, execute , call method load_dictionary().
- Now you can turn on the spell check immediately after calling the loading of dictionaries, without worrying about the asynchronous loading.
- Words equal to an empty string are excluded from the check. This reduces the number of operations and eliminates the error that occurred in type.js if the dictionaries were not specified correctly.

## How to use
See first comment spellcheck_ace.js
