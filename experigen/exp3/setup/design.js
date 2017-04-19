function parseUri(str) {
	var	o   = parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};

Experigen.initialize = function () {

    add = function(arr, x) {
        if (arr.indexOf(x) == -1) {
            arr.push(x);
        }
        return(arr);
    }

    debug_popup = function(training, test, cb_list, n_unvoiced) {
        var html = '';
        html = html + '<h2>Training</h2>';
        html = html + '<h3>List: ' + cb_list + '</h3>';
        html = html + '<h3>Number of unvoiced onset types: ' + n_unvoiced + '</h3>';
        for (var i = 0; i < training.length; i++) {
            html = html + '<p>' + training[i]['item'] + ' (' + 
                    training[i]['type'] + ')' + '</p>';
        }

        html = html + '<h2>Test</h2>';
        for (var i = 0; i < test.length; i++) {
            html = html + '<p>' + i + ': ' + test[i]['item'] + ' (' +
                test[i]['type'] + ')' + '</p>';
        }
        var popup = open("", "Popup", "width=600,height=800,scrollbars=1");
        popup.document.body.innerHTML = '';
        div = popup.document.createElement('div');
        div.innerHTML = html;
        popup.document.body.appendChild(div);
    }

    generate_design = function(dis, cb_list, n_unvoiced) {

        vowels = ['ai', 'au', 'ua', 'ia'];
        sonorants = ['m', 'n'];
        training_onsets = ['w', 'w', 'l', 'l', 'y', 'y'];
        test_onsets = ['z', 'd', 'p', 't', 'k'];
        unvoiced_stops = ['p', 't', 'k'];
        unvoiced_stop = unvoiced_stops[cb_list - 1];

        if (n_unvoiced == 1) {
            training_onsets = training_onsets.concat([unvoiced_stop,
                unvoiced_stop]);
        }
        else if (n_unvoiced == 2) {
            for (i = 0; i < 3; i++) {
                if (unvoiced_stops[i] != unvoiced_stop) {
                    training_onsets = training_onsets.concat(
                            [unvoiced_stops[i]]);
                }
            }
        }

        training_onsets = training_onsets.shuffle();
        test_onsets = test_onsets.shuffle();

        var items = dis.resource("items");
        for (i = 0; i < items.length; i++) {
            items[i]['stimulus'] = items[i]['item'] + '.wav.mp3';
        }

        var n_training_items = 8;
        var n_test_items = 5;
        var n_trials = n_training_items + n_test_items;

        var vowel_order = [];
        var sonorant_order = [];
        // 10 = "many times"
        for (var i = 0; i < 10; i++) {
            vowel_order = vowel_order.concat(vowels.shuffle())
            sonorant_order = sonorant_order.concat(sonorants.shuffle())
        }

        vowel_order = vowel_order.slice(0, n_trials);
        sonorant_order = sonorant_order.slice(0, n_trials);

        var training_trials = [];
        for (var b = 0; b < n_training_items; b++) {
            for (var i = 0; i < items.length; i++) {
                if (items[i]['vowel'] == vowel_order[b] &&
                        items[i]['item'].substr(2, 1) == sonorant_order[b] &&
                        items[i]['onset'] == training_onsets[b]) {
                    training_trials.push(items[i]);
                    break;
                }
            }
        }
        var training = training_trials.pairWith('view', 'training.ejs');

        var test_trials = [];
        for (var b = 0; b < n_test_items; b++) {
            for (var i = 0; i < items.length; i++) {
                var x = b + n_training_items;
                if (items[i]['vowel'] == vowel_order[x] &&
                        items[i]['item'].substr(2, 1) == sonorant_order[x] &&
                        items[i]['onset'] == test_onsets[b]) {
                    test_trials.push(items[i]);
                    break;
                }
            }
        }

        var test = test_trials.pairWith('view', 'testing.ejs');

        //debug_popup(training, test, cb_list, n_unvoiced);

        dis.addStaticScreen("intro.ejs");
        dis.addBlock(training);
        dis.addStaticScreen("now_test.ejs");
        dis.addBlock(test);
        dis.addStaticScreen("demographic.html");
        dis.addStaticScreen("finalthanks.ejs");
    }

    var p = parseUri(window.location);
    var params = p.queryKey.params.split('a');
    var cb_list = params[0];
    var n_unvoiced = params[1];

    generate_design(this, cb_list, n_unvoiced);
}
