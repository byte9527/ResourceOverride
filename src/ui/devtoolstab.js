(function() {
    "use strict";

    /* globals chrome */

    const app = window.app;
    const ui = app.ui;
    const util = app.util;

    app.mainSuggest = app.suggest();
    app.requestHeadersSuggest = app.suggest();
    app.responseHeadersSuggest = app.suggest();
    app.files = {};

    function renderData() {
        console.log('Rendering data...');
        app.files = {};
        ui.domainDefs.children().remove();
        
        // Try to get existing domains from storage
        chrome.runtime.sendMessage({action: "getDomains"}, function(domains) {
            if (domains && domains.length) {
                console.log('Loading existing domains:', domains.length);
                domains.forEach(function(domain) {
                    const domainMarkup = app.createDomainMarkup(domain);
                    ui.domainDefs.append(domainMarkup);
                });
            } else {
                console.log('No existing domains, creating default');
                // Just create a simple default domain for now
                const newDomain = app.createDomainMarkup({rules: [{type: "normalOverride"}]});
                ui.domainDefs.append(newDomain);
                newDomain.find(".domainMatchInput").val("*");
            }
            console.log('Data rendered');
        });
    }
    
    // Make renderData globally accessible
    app.renderData = renderData;

    function init() {
        console.log('Initializing UI...');
        
        app.mainSuggest.init();
        app.requestHeadersSuggest.init();
        app.responseHeadersSuggest.init();
        app.requestHeadersSuggest.fillOptions(app.headersLists.requestHeaders);
        app.responseHeadersSuggest.fillOptions(app.headersLists.responseHeaders);

        renderData();

        ui.addDomainBtn.on("click", function() {
            console.log('Add domain clicked');
            const newDomain = app.createDomainMarkup();
            newDomain.find(".domainMatchInput").val("*");
            ui.domainDefs.append(newDomain);
            // Save the new domain
            chrome.runtime.sendMessage({
                action: "saveDomain", 
                data: app.getDomainData(newDomain)
            });
        });

        ui.helpBtn.on("click", function() {
            ui.helpOverlay.toggle();
        });

        ui.helpCloseBtn.on("click", function() {
            ui.helpOverlay.hide();
        });

        if (!chrome.devtools) {
            ui.showSuggestions.hide();
            ui.showSuggestionsText.hide();
        }

        console.log('UI initialized');
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
