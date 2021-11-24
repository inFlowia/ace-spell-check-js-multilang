/* Ace Editor Spellcheck - MultiLang
This plugin is a fork of swenson/ace_spell_check_js by Christopher Swenson.
Author of fork: inFlowia Lab.

v 0.1

DEPENDENCIES:
	jQuery 	(tested on 3.3.1)
	typo.js (tested on 2021-11-20)
	ace.js 	(tested on 1.4.13)
	functions by inFlowia Lab.:
		get_this_dir_url() 	(js)
		doc_root() 					(PHP)

USE:
	- Add in some file on your site all the necessary PHP-functions from inFlowia Lab. for this script.
	- In the add_to_usr_dict.php file fix the constant:
		DEPS_PATH - path to the file where the doc_root() function is set
	- Ensure accessibility of all the necessary JS functions from inFlowia Lab. for this script.
	- Connect jQuery, typo.js and ace.js to pages that will use this plugin.
	- Modify the array so that the paths to all necessary dictionaries are correct.
		There are no requirements for the lang field. You can specify in this field any desired designation of the dictionary.
		Don't delete the 'user-dict' dictionary - this is your users dictionary.
		You can add any number of dictionaries to this array, depending on how many dictionaries you want to use for checking.
	- Connect this script to the pages where you want to use it.
	- Initialize the object:
		if(typeof spellcheck_ace === 'undefined')
			spellcheck_ace = new Spellcheck_ace('content');
		Argument - ace editors id.
		Note that the spellcheck_ace variable does not need to be declared. It has already been declared in this script.
		Carefully! Loading large dictionaries (for example, such as Russian) can take a long time, this can cause the browser to freeze.
	- Enable spellchecking: spellcheck_ace.enable_spellcheck();
		You can call this right after initializing the object. In fact, the check will turn on only after all dictionaries are loaded.
	- To disable spell checking, call spellcheck_ace.disable_spellcheck();
	- To add word in users dictionary, call spellcheck_ace.add_to_usr_dict(desired_word);
	- To get an array of suggestions for misspelled word, call:
	spellcheck_ace.suggest_word_for_misspelled(misspelledWord);

CHANGES:
	0.1 (differences from the original plugin)
	- Added the ability to use multiple dictionaries.
	- Added support for characters other than Latin. However, in this regard, the requirements for the freshness of the browser have increased greatly. For most browsers releases of 2018 will go, for Firefox - 2020. Detail: https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/RegExp see compatibility table, line "Unicode property escapes (\p{...})").
		Reason: replacing part of regular expressions like /[^a-zA-Z\-']/ with /[^\p{Alpha}\-']/u. If you want to bring back support for older browsers, you can replace the new regex form with a more conservative but less versatile one: /[^a-zA-Zа-яА-Я\-']/ (example for Cyrillic character set).
	- Added support for a users dictionary with the ability to add words to it. To add a word, call the add_to_usr_dict('desired_word') function. If no word is added check permissions for usr-dict.dic
	- The plugin is designed as a class.
	- Loading dictionaries no longer happens automatically, as large dictionaries cause a noticeable browser hangup. To download dictionaries, execute the function spellcheck_ace_load_dictionary();
	- Now you can turn on the spell check immediately after calling the loading of dictionaries, without worrying about the asynchronous loading.
	- Words equal to an empty string are excluded from the check. This reduces the number of operations and eliminates the error that occurred in type.js if the dictionaries were not specified correctly.





FLAWS:
	- Disabling spell check simply hides the text decoration but does not disable the editor's change handler.
	- It would be nice to separate the user dictionary from typo and check against it with your own method, this would allow you to add arbitrary words to it, without hunspell and typo.js restrictions.
	- The current word-splitting method in _misspelled() causes words equal to the empty string to appear in the array.
*/



let spellcheck_ace;

class Spellcheck_ace{
	/*
		ARGS.:
			editor - This should be the id of your editor element.
	*/
	constructor(editor){
		this._dictionaries = [
			{
				lang: "en_US",
				dicPath: "/lib/typo-js/typo/dictionaries/en_US/en_US.dic",
				affPath: "/lib/typo-js/typo/dictionaries/en_US/en_US.aff"
			},
			{
				lang: "ru_RU",
				dicPath: "/lib/typo-js/typo/dictionaries/ru_RU/ru_RU.dic",
				affPath: "/lib/typo-js/typo/dictionaries/ru_RU/ru_RU.aff"
			},
			{
				lang: "usr-dict", // if change this, then change spellcheck_ace_add_to_usr_dict()
				dicPath: Spellcheck_ace.this_dir + "usr-dict/usr-dict.dic",
				affPath: Spellcheck_ace.this_dir + "usr-dict/usr-dict.aff"
			}
		];
		this._dictionaries.forEach((dict)=>{
			dict.typo = null;
		});

		this._loaded_dicts_number = 0;
		this.is_dicts_loaded = false;
		this._dictionaries.forEach((dictionary)=>{
			this._load_dictionary(dictionary)
		});

		this._editor = editor;

		// Make red underline for gutter and words.
		$("<style type='text/css'>.ace_marker-layer .misspelled { position: absolute; z-index: -2; border-bottom: 1px solid red; margin-bottom: -1px; }</style>").appendTo("head");
		$("<style type='text/css'>.misspelled { border-bottom: 1px solid red; margin-bottom: -1px; }</style>").appendTo("head");

		this.spellcheckEnabled = false; // Flag! The initial value must always be false

		this._contents_modified = true;

		this._currently_spellchecking = false;

		this._markers_present = [];

		// ensuring that [this] in methods of this class points to an instance of that class
		this._load_dictionary 						= this._load_dictionary.bind(this);
		this._misspelled 									= this._misspelled.bind(this);
		this.spell_check 									= this.spell_check.bind(this);
		this.enable_spellcheck						= this.enable_spellcheck.bind(this);
		this.disable_spellcheck						= this.disable_spellcheck.bind(this);
		this._clear_spellcheck_markers		= this._clear_spellcheck_markers.bind(this);
		this.suggest_word_for_misspelled	= this.suggest_word_for_misspelled.bind(this);
		this.add_to_usr_dict							= this.add_to_usr_dict.bind(this);
	}


	_load_dictionary(dictionary){
		// Load the dictionary
		// We have to load the dictionary files sequentially to ensure
		$.get(dictionary.dicPath, (data)=>{
			dictionary.dicData = data; // if not field of dictionary field, then due to asynchrony, typo will confuse dictionaryTables
		}).done(()=>{
			$.get(dictionary.affPath, (data)=>{
				dictionary.affData = data; // if not field of dictionary field, then due to asynchrony, typo will confuse dictionaryTables
			}).done(()=>{
				console.log('Spellcheck Ace: ' + dictionary.lang + ' dictionary almost loaded');
				dictionary.typo = new Typo(dictionary.lang, dictionary.affData, dictionary.dicData);
				// This is an example of loading dictionaries asynchronously:
				//dictionary.typo = new Typo(dictionary.lang, null, null, {asyncLoad: true, dictionaryPath: '/lib/typo-js/typo/dictionaries', loadedCallback: this.spell_check});
				/* With this method of initialization, a more stringent requirement for the path of dictionaries appears:
					При такой инициализации словари должны хранится в:
					[dictionaryPath]/[dictionary.lang]/[dictionary.lang].dic
					[dictionaryPath]/[dictionary.lang]/[dictionary.lang].aff
				*/
				console.log('Spellcheck Ace: ' + dictionary.lang + ' dictionary loaded');
				this._loaded_dicts_number++;
				if(this._loaded_dicts_number === this._dictionaries.length){
					this.is_dicts_loaded = true;
					console.log('Spellcheck Ace: ' + dictionary.lang + ' all dictionaries loaded');
				}

				// Deleted only to save memory. They are strings, not objects, so a value is passed in, not a reference.
				delete dictionary.dicData;
				delete dictionary.affData;
				//

				// this is so that you can turn on the spelling check immediately after the call to load the dictionaries, without worrying about its asynchrony
				if(this.spellcheckEnabled)
					this.spell_check();
			});
		});
	} // _load_dictionary()



	// Check the spelling of a line, and return [start, end]-pairs for misspelled words.
	_misspelled(line) {
		// var words = line.split(/[^a-zA-Z\-']/); // original. Doesn't work with non-Latin characters.
		var words = line.split(/[^\p{Alpha}\-']/u); // this regex supports non-latin characters
		var i = 0;
		var bads = [];
		for (let word in words) {
			var x = words[word] + "";
			// var checkWord = x.replace(/[^a-zA-Z\-']/g, ''); // original. Doesn't work with non-Latin characters.
			var checkWord = x.replace(/[^\p{Alpha}\-']/ug, ''); // this regex supports non-latin characters
			if(x !== ''){ // Exclude empty words. Otherwise: TypeError: Cannot read property 'toLowerCase' of undefined in typo.js
				let err_count = 0; // the number of dictionaries in which this word is considered erroneous
				this._dictionaries.forEach((dictionary)=>{
					if (!dictionary.typo.check(checkWord))
						err_count++;
				})
			  if (err_count === this._dictionaries.length) { // if no dictionary is considered correct
			    bads[bads.length] = [i, i + words[word].length];
			  }
			} // END Exclude empty words.
		  i += words[word].length + 1;
	  }
	  return bads;
	}



	// Spell check the Ace editor contents.
	spell_check() {
	  // Wait for the dictionary to be loaded.
		let is_dictionaries_loaded = true;
		this._dictionaries.forEach((dictionary)=>{
			if (dictionary.typo == null) // if at least one is not loaded
				is_dictionaries_loaded = false;
		})
		if(!is_dictionaries_loaded)
			return;

	  if (this._currently_spellchecking) {
	  	return;
	  }

	  if (!this._contents_modified) {
	  	return;
	  }
	  this._currently_spellchecking = true;
	  var session = ace.edit(this._editor).getSession();

		// Clear all markers and gutter
		this._clear_spellcheck_markers();
		// Populate with markers and gutter
	  try {
		  var Range = ace.require('ace/range').Range
		  var lines = session.getDocument().getAllLines();
		  for (var i in lines) {
		    // Check spelling of this line.
		    var misspellings = this._misspelled(lines[i]);

		    // Add markers and gutter markings.
		    if (misspellings.length > 0) {
		      session.addGutterDecoration(i, "misspelled");
		    }
		    for (var j in misspellings) {
		      var range = new Range(i, misspellings[j][0], i, misspellings[j][1]);
		      this._markers_present[this._markers_present.length] = session.addMarker(range, "misspelled", "typo", true);
		    }
		  }
		} finally {
			this._currently_spellchecking = false;
			this._contents_modified = false;
		}
	}



	enable_spellcheck() {
		this.spellcheckEnabled = true
		ace.edit(this._editor).getSession().on('change', function(e) {
			if (this.spellcheckEnabled) {
				this._contents_modified = true;
				this.spell_check();
			};
		})
		// needed to trigger update once without input
		this._contents_modified = true;
		this.spell_check();
	}



	disable_spellcheck() {
		this.spellcheckEnabled = false
		// Clear the markers
		this._clear_spellcheck_markers();
	}



	_clear_spellcheck_markers() {
		var session = ace.edit(this._editor).getSession();
		for (var i in this._markers_present) {
			session.removeMarker(this._markers_present[i]);
		};
		this._markers_present = [];
		// Clear the gutter
		var lines = session.getDocument().getAllLines();
		for (var i in lines) {
			session.removeGutterDecoration(i, "misspelled");
		};
	}



	suggest_word_for_misspelled(misspelledWord) {
		// перепроверка
		var is_spelled_correctly = true;
		let err_count = 0; // the number of dictionaries in which this word is considered erroneous
		this._dictionaries.forEach((dictionary)=>{
			if (!dictionary.typo.check(misspelledWord))
				err_count++;
		})
		if (err_count === this._dictionaries.length) // if no dictionary is considered correct
			is_spelled_correctly = false;

		var array_of_suggestions = Array();
		this._dictionaries.forEach((dictionary)=>{
			array_of_suggestions = array_of_suggestions.concat(dictionary.typo.suggest(misspelledWord));
		});

		if (is_spelled_correctly || array_of_suggestions.length === 0) { return false }
		return array_of_suggestions
	}



	/* adds a word to a custom dictionary
	*/
	add_to_usr_dict(word){
		let usr_dict;
		this._dictionaries.forEach((dict)=>{
			if(dict.lang === 'usr-dict')
				usr_dict = dict;
		});

		// checking for the need to add
		if (usr_dict.typo.check(word))
			return;

		// adding
		var word = word.replace(/[^\p{Alpha}\-']/ug, ''); // clearing the selection so as not to write something invalid
		$.ajax({
			type: 'POST',
			url: Spellcheck_ace.this_dir + 'add_to_usr_dict.php',
			data: {word}
		}).done(()=>{
			// reloading the user dictionary and re-checking the spelling.
			this._contents_modified = true;
			this._load_dictionary(usr_dict);
		});


	}
} // class Spellcheck_ace
Spellcheck_ace.this_dir = get_this_dir_url(document.currentScript);
