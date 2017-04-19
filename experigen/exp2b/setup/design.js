Experigen.initialize = function () {

    add = function(arr, x) {
        if (arr.indexOf(x) == -1) {
            arr.push(x);
        }
        return(arr);
    }

    create_block = function(items, all_items, vowel_order, start_index) {
        var block_order = items.shuffle();
        var res = [];
        for (var b = 0; b < items.length; b++) {
            for (var i = 0; i < all_items.length; i++) {
                var x = start_index + b;
                if (all_items[i]['consonant'] == block_order[b] &&
                        all_items[i]['vowel'] == vowel_order[x]) {
                    res.push(all_items[i]);
                    break;
                }
            }
        }
        return(res);
    }

    create_balanced_test_block = function(items, all_items, vowel_order,
            start_index) {
        var arr = [[], [], [], []];
        var ind;
        for (var i = 0; i < items.length; i++) {
            if (items[i]['type'] == 'training') {
                ind = 0;
            }
            else if (items[i]['type'] == 'arbitrary') {
                ind = 1;
            }
            else if (items[i]['type'] == 'identical') {
                ind = 2;
            }
            arr[ind] = add(arr[ind], items[i]['consonant']);
        }
        var mid = arr[0].length / 2;
        arr[3] = arr[0].slice(mid);
        arr[0] = arr[0].slice(0, mid);

        var b1_items = [];
        var b2_items = [];
        for (var i = 0; i < 4; i++) {
            b1_items.push(arr[i][i]);
            b1_items.push(arr[i][(i+1)%4]);
            b2_items.push(arr[i][(i+2)%4]);
            b2_items.push(arr[i][(i+3)%4]);
        }

        b1 = create_block(b1_items, all_items, vowel_order, start_index);
        b2 = create_block(b2_items, all_items, vowel_order, 
                start_index + 8);

        return(b1.concat(b2));

    }

    debug_popup = function(training, test) {
        var html = '';
        html = html + '<h2>Training</h2>';
        for (var i = 0; i < training.length; i++) {
            if (i % 8 == 0) {
                html = html + '<p><b>Block ' + (i / 8 + 1) + '</b></p>';
            }
            html = html + '<p>' + training[i]['stimulus'] + '</p>';
        }

        html = html + '<h2>Test</h2>';
        for (var i = 0; i < test.length; i++) {
            html = html + '<p>' + i + ': ' + test[i]['stimulus'] + ': ' +
                test[i]['type'] + '</p>';
        }
        var popup = open("", "Popup", "width=600,height=800,scrollbars=1");
        popup.focus();
        div = popup.document.createElement('div');
        div.innerHTML = html;
        popup.document.body.appendChild(div);
    }

    generate_design = function(dis, n_exposures) {
	
        var items = dis.resource("items");

        var vowels = [];
        var training_items = [];
        var test_items = [];
        var test_items_fancy = [];

        for (var i = 0; i < items.length; i++) {
            vowels = add(vowels, items[i]['vowel']);
            test_items = add(test_items, items[i]['consonant']);
            test_items_fancy = add(test_items_fancy, items[i]);
            if (items[i]['attested'] == 'yes') {
                training_items = add(training_items, items[i]['consonant']);
            }
        }

        var n_training_items = training_items.length;
        var n_test_items = test_items.length;
        var n_trials = n_training_items * n_exposures + n_test_items;

        var vowel_order = [];
        for (var i = 0; i < n_exposures * 4; i++) {
            vowel_order = vowel_order.concat(vowels.shuffle())
        }

        vowel_order = vowel_order.slice(0, n_trials);

        var training_trials = [];
        for (var exposure = 0; exposure < n_exposures; exposure++) {
            block = create_block(training_items, items, vowel_order,
                    exposure * n_training_items);
            training_trials = training_trials.concat(block);
        }

        var training = training_trials.pairWith('view', 'training.ejs');

        test_trials = create_balanced_test_block(test_items_fancy, items,
                vowel_order, n_exposures * n_training_items);

        var test = test_trials.pairWith('view', 'testing.ejs');

        //debug_popup(training, test);

        dis.addStaticScreen("intro.ejs");
        dis.addBlock(training);
        dis.addStaticScreen("now_test.ejs");
        dis.addBlock(test);
        dis.addStaticScreen("demographic.html");
        dis.addStaticScreen("finalthanks.ejs");
    }

	exp = parseInt(window.location.search.replace("?exp=", ""));
    generate_design(this, exp);
}
