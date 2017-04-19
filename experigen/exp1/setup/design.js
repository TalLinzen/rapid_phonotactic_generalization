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

// 12 counterbalancing orders, based on Cristia et al 2013 p. 266: 
// the 'attested' onset is the one that's shared between training and testing;
// 'legal' is generalization-conforming but not in the training set;
// 'illegal' is an onset that doesn't conform to the generalization
// (Numbers on the right indicate rows in Cristia et al's table)
counterbalancing = [
    {'voicing': 'voiced', 'attested': 'g', 'legal': 'b', 'illegal': 'p'}, //1
    {'voicing': 'voiced', 'attested': 'z', 'legal': 'd', 'illegal': 't'}, //2 
    {'voicing': 'voiced', 'attested': 'D', 'legal': 'g', 'illegal': 'k'}, //3
    {'voicing': 'voiced', 'attested': 'd', 'legal': 'v', 'illegal': 'f'}, //4
    {'voicing': 'voiced', 'attested': 'v', 'legal': 'z', 'illegal': 's'}, //5
    {'voicing': 'voiced', 'attested': 'b', 'legal': 'D', 'illegal': 'T'}, //6
    {'voicing': 'voiceless', 'attested': 'k', 'legal': 'p', 'illegal': 'b'},//7
    {'voicing': 'voiceless', 'attested': 's', 'legal': 't', 'illegal': 'd'},//8
    {'voicing': 'voiceless', 'attested': 'T', 'legal': 'k', 'illegal': 'g'},//9
    {'voicing': 'voiceless', 'attested': 't', 'legal': 'f', 'illegal': 'v'},//10
    {'voicing': 'voiceless', 'attested': 'f', 'legal': 's', 'illegal': 'z'},//11
    {'voicing': 'voiceless', 'attested': 'p', 'legal': 'T', 'illegal': 'D'},//12
]

Experigen.initialize = function () {

    n_test_blocks = 2;
    block_size = 5;

    add = function(arr, x) {
        if (arr.indexOf(x) == -1) {
            arr.push(x);
        }
        return(arr);
    }

    create_block = function(items, all_items, v1_order, v2_order,
            sonorant_order, start_index) {
        var block_order = items.shuffle();
        var res = [];
        for (var b = 0; b < items.length; b++) {
            for (var i = 0; i < all_items.length; i++) {
                var x = start_index + b;
                if (all_items[i]['c1'] == block_order[b] &&
                        all_items[i]['v1'] == v1_order[x] &&
                        all_items[i]['v2'] == v2_order[x] &&
                        all_items[i]['n'] == sonorant_order[x]) {
                    res.push(all_items[i]);
                    break;
                }
            }
        }
        return(res);
    }

    debug_popup = function(training, test) {
        var html = '';
        html = html + '<h2>Training</h2>';
        for (var i = 0; i < training.length; i++) {
            if (i % block_size == 0) {
                html = html + '<p><b>Block ' + (i / block_size + 1) + '</b></p>';
            }
            html = html + '<p>' + training[i]['stimulus'] + '</p>';
        }

        html = html + '<h2>Test</h2>';
        for (var i = 0; i < test.length; i++) {
            html = html + '<p>' + i + ': ' + test[i]['stimulus'] + ' (' +
                test[i]['condition'] + ')' + '</p>';
        }
        var popup = open("", "Popup", "width=600,height=800,scrollbars=1");
        div = popup.document.createElement('div');
        div.innerHTML = html;
        popup.document.body.appendChild(div);
    }

    generate_design = function(dis, n_exposures, cb_list) {
	
        var items = dis.resource("items");

        var v1 = [];
        var v2 = [];
        var sonorants = [];
        var training_items = [];
        var test_items = [];

        var cb = counterbalancing[cb_list - 1];

        for (var i = 0; i < items.length; i++) {
            v1 = add(v1, items[i]['v1']);
            v2 = add(v2, items[i]['v2']);
            sonorants = add(sonorants, items[i]['n']);
            c1 = items[i]['c1'];
            if (items[i]['voicing'] == cb['voicing'] && c1 != cb['legal']) {
                training_items = add(training_items, c1);
            }
        }

        test_items = [cb['legal'], cb['attested'], cb['illegal']];

        var n_training_items = 5;
        var n_test_items = test_items.length;
        var n_trials = n_training_items * n_exposures + n_test_items * 
            n_test_blocks;

        var v1_order = [];
        var v2_order = [];
        var sonorant_order = [];
        for (var i = 0; i < n_exposures * 4; i++) {
            v1_order = v1_order.concat(v1.shuffle())
            v2_order = v2_order.concat(v2.shuffle())
            sonorant_order = sonorant_order.concat(sonorants.shuffle())
        }

        v1_order = v1_order.slice(0, n_trials);
        v2_order = v2_order.slice(0, n_trials);
        sonorant_order = sonorant_order.slice(0, n_trials);

        var training_trials = [];
        for (var exposure = 0; exposure < n_exposures; exposure++) {
            block = create_block(training_items, items, v1_order, v2_order,
                    sonorant_order, exposure * n_training_items);
            training_trials = training_trials.concat(block);
        }

        var training = training_trials.pairWith('view', 'training.ejs');

        var test_trials = [];
        for (var n_block = 0; n_block < n_test_blocks; n_block++) {
            n = n_exposures * n_training_items + n_test_items * n_block;
            block = create_block(test_items, items, v1_order, v2_order,
                    sonorant_order, n)
            test_trials = test_trials.concat(block);
        }

        var types = ['legal', 'illegal', 'attested'];
        for (var i = 0; i < test_trials.length; i++) {
            for (t = 0; t < types.length; t++) {
                if (test_trials[i]['c1'] == cb[types[t]]) {
                    test_trials[i]['condition'] = types[t];
                }
            }
        }

        var test = test_trials.pairWith('view', 'testing.ejs');

        //debug_popup(training, test);

        dis.addStaticScreen("intro.ejs");
        dis.addBlock(training);
        dis.addStaticScreen("now_test.ejs");
        dis.addBlock(test);
        dis.addStaticScreen("demographic.html");
        dis.addStaticScreen("finalthanks.ejs");
    }

    var p = parseUri(window.location);
    var params = p.queryKey.params.split('a');
    var n_exposures  = params[0];
    var cb_list = params[1];

    generate_design(this, n_exposures, cb_list);
}
