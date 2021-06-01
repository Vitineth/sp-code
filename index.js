/**
 * Contains an array of all modules available in the system
 * @type {{data: {index: number, title: string, code: string}}[]}
 */
let moduleCache = [];
/**
 * Contains the last query that was made in the search field. This is used to reduce the
 * amount of updates that need to be made to the search field.
 * @type {undefined|string}
 */
let lastUpdate = undefined;
/**
 * Contains the callback to use when an element in the dropdown list is clicked. If undefined
 * then nothing is executed
 * @type {undefined|Function}
 */
let dropCallback = undefined;
/**
 * Contains a static reference to the list of modules in the DOM, this is cached to speed up access
 */
const moduleList = document.querySelector('#modules');
/**
 * The recycler used in the search functionality
 */
let moduleRecycler = undefined;

/**
 * Calculates the height of a recycler element containing a parameter data title. This
 * will approximate it based on the length of the string but is likely to not be 
 * completely accurate.
 * 
 * @param {{data:{title: string}}} params the parameter from the VanillaRecyclerView
 * @returns number the height of the element containing this record
 */
function recyclerCalculateElementSize(params) {
    if (params.data.title.length <= 26) return 50;
    if (params.data.title.length <= 61) return 65;
    if (params.data.title.length <= 97) return 80;
    if (params.data.title.length <= 133) return 95;
    if (params.data.title.length <= 169) return 110;
    return 125;
}

/**
 * Handles a click on an element in the recyler view, this will look it up in the array of
 * modules and then call dropCallback if it has been defined with the module and the event
 * @param {MouseEvent} e the mouse event generated from the DOM interaction
 */
function recyclerElementOnClick(e) {
    const target = e.target.closest('.entry').getAttribute('data-entry');
    const module = moduleCache.find((e) => e.index === Number(target));
    if (dropCallback) dropCallback(module, e);
}

/**
 * Generates a layout element and then returns it. This element will be bound with the onClick
 * handler and have the parameter index assigned as a data-entry. This does not assign the new
 * element to anything
 * @param {{data: {index: number, title: string, code: string}}} params the parameter to generate an element for
 */
function recyclerInitializeElement(params) {
    const layout = document.createElement('div');
    layout.classList.add('entry');
    layout.setAttribute('data-entry', params.data.index);
    layout.onclick = recyclerElementOnClick;
    layout.innerHTML = `<div class="code">${params.data.code}</div> ${params.data.title}`;
    return layout;
}

/**
 * Updates the layout DOM component with the content of params
 * @param {{data: {index: number, title: string, code: string}}} the module entry
 * @param {Element} the element to update
 */
function recyclerMountElement(params, layout) {
    layout.setAttribute('data-entry', params.data.index);
    layout.innerHTML = `<div class="code">${params.data.code}</div> ${params.data.title}`;
    layout.onclick = recyclerElementOnClick;
}

/**
 * Unmounts the given element from the recycler by invalidating the onclick handler
 * @param {Element} layout the DOM element to unbind / unmount
 */
function recyclerUnmount(layout) {
    layout.onclick = undefined;
}

/**
 * Queries the list of modules for the query string and then updates the recycler to
 * display the filtered list. This forms the foundation of the search system
 * @param {string} query the query to search with
 * @returns undefined
 */
function updateModuleList(query) {
    // If the query has not changed then there's no point updating the list.
    // Otherwise make sure we save the update
    if (query === lastUpdate) return;
    else lastUpdate = query;

    // Create a copy of all the possible modules so we can then filter them. If
    // the query is actually defined find any module that has the text as a
    // substring of the code or title. This will be the array of search results
    let options = [...moduleCache];
    if (query !== "") options = options.filter(
        (e) => e.code.toLowerCase().indexOf(query.toLowerCase()) !== -1
            || e.title.toLowerCase().indexOf(query.toLowerCase()) !== -1,
    );

    // If the recycler is undefined then we need to wait for it to become defined
    // so we can update the recycler
    if (typeof (moduleRecycler) === 'undefined') {
        // Check ever 100ms for the recycler
        const i = setInterval(() => {
            if (typeof (moduleRecycler) !== 'undefined') {
                // Once it is defined, clear this interval and update the data being displayed
                clearInterval(i);
                moduleRecycler.setData(options);
            }
        }, 100);
    } else {
        // Otherwise update the data directly
        moduleRecycler.setData(options);
    }
}

/**
 * This will fetch the list of modules from modules.json, parse them to add a globally unique index
 * and save it into the moduleCache. Once done it will call updateModuleList with an empty
 * string to represent a blank search which should fill the recycler with all the information it needs
 * @returns {Promise}
 */
function loadModules() {
    return fetch('/modules.json').then((r) => r.json()).then((d) => {
        moduleCache = d.map((e, i) => ({ ...e, index: i }));
        updateModuleList("");
    });
}

/**
 * Hides the dropdown menu at #module-entries my moving it out of the way rather than changing the visibility
 * It is docked at -1000px and updates the module list so it contains the full list ready for the display next
 * time
 */
function hideDropdown() {
    dropCallback = undefined;
    document.querySelector("#module-entries").style.top = '0px';
    document.querySelector("#module-entries").style.left = '-1000px';
    updateModuleList("");
}

/**
 * Shows the dropdown list by moving it into position, assigning the dropdown handler and then updating the module
 * list so it is fresh and contains all modules
 * @param {Function} onClick the handler to execute when an entry of the dropdown list is clicked
 * @param {Node} parent the parent element of the input box, this is used to calculate the position of the dropdown
 */
function showDropdown(onClick, parent) {
    dropCallback = onClick;
    document.querySelector("#module-entries").style.top = parent.getBoundingClientRect().bottom + 'px';
    document.querySelector("#module-entries").style.left = parent.getBoundingClientRect().left + 'px';
    updateModuleList("");
}

/**
 * Clones a copy of the #module-row element and assigns its onclick listeners ready for the user to interact with it.
 * When ready it will insert it into the module list using the cached static reference
 */
function cloneAndInsertModuleRow() {
    const copy = document.querySelector('#module-row').content.cloneNode(true);

    // On remove just delete the entire thing
    copy.querySelector('.remove').onclick = function () {
        this.parentElement.remove();
    }

    // When you type we need to update the search list which should be displayed as a result of the onfocus handler
    copy.querySelector('.module').oninput = function () {
        updateModuleList(this.value);
    }

    // When you focus on the module field we want to show the dropdown list
    copy.querySelector('.module').onfocus = function () {
        // When you click the element, copy in all the information from the callback and then hide the dropdown menu
        showDropdown((module) => {
            const parent = this.closest('.record');

            this.value = module.code;
            parent.querySelector('.credits').value = module.credits;
            parent.querySelector('.sem1').checked = module.semester === '1';
            parent.querySelector('.sem2').checked = module.semester === '2';

            hideDropdown();
        }, this);
    };

    // Finally insert it into the DOM
    moduleList.appendChild(copy);
}

/**
 * This inserts the text into the warning element and then makes it visible
 * @param {string} message the message to display on the form
 */
function warn(message) {
    const warning = document.getElementById('warning');
    warning.textContent = message;
    warning.style.display = 'block';
}

/**
 * Hides the warning element but does not clear its content
 */
function unwarn() {
    document.getElementById('warning').style.display = 'none';
}

/**
 * Converts the form on the web page into a list of modules which contains the module code, the
 * credits it worth, the grade they got an whether it was in semester one or two
 * @returns {{moduleCode: string, grade: number, credits: number, semester: 'sem1' | 'sem2'}[]}
 */
function convertFormToModuleArray() {
    const rows = document.querySelectorAll('#modules > div.record');
    let modules = [];
    for (const e of rows) {
        const moduleCode = e.querySelector('.module').value;
        const grade = Number(e.querySelector('.grade').value);
        const credits = Number(e.querySelector('.credits').value);
        const semester = e.querySelector('.sem1').checked;

        if (moduleCode.length === 0) {
            warn(`Module code must be specified`)
            return false;
        }

        if (credits === 0) {
            warn('Credits must be specified');
            return false;
        }

        modules.push({
            moduleCode,
            grade,
            credits,
            semester: semester ? 'sem1' : 'sem2',
        })
    }

    return modules;
}

/**
 * Calculates all possible combinations of modules that can be sp-coded and returns them as the grade
 * possible if they are SP coded and the list of modules removed for every option
 * @param {any} semesterGrades the object of modules and their grades, credits etc
 * @returns {{grade: number, remove: string[]}[]}
 */
function calculateSemester(semesterGrades) {
    // Create a list of just module codes
    const moduleCodes = Object.values(semesterGrades).map((x) => x.moduleCode)

    // function to get all combinations possible
    function combination(values) {
        function* combinationRepeat(size, v) {
            if (size)
                for (var chr of values) {
                    if (v.includes(chr)) continue
                    yield* combinationRepeat(size - 1, [...v, chr]);
                }
            else yield v;
        }

        let arr = []
        for (let i = 1; i <= values.length; i++) {
            arr = arr.concat([...combinationRepeat(i, [])])
        }
        return arr
    }

    // get all combinations possible
    let output = combination(moduleCodes);

    // sort it to remove repeats
    output = [...output].map((x) => x.sort())

    // remove repeats
    let pairings = output.map(JSON.stringify).filter((v, i, a) => a.indexOf(v) === i).map(JSON.parse)

    const validPairings = [[]]

    // get valid pairings based on module credit (allow combinations up to 30)
    for (const pairing of pairings) {
        let total = 0
        for (const moduleC of pairing) {
            total += semesterGrades[moduleC].credits
        }
        if (total <= 30) {
            validPairings.push(pairing)
        }
    }

    const results = [];

    // get the other classes not in your SP valid pairings (?? idk how to phrase this better)
    for (const group of validPairings) {
        // Filter out the options in the group for this combination
        const modulesToConsider = moduleCodes.filter((m) => !group.includes(m))

        // Total the credits
        let totalCredits = 0
        for (const m of modulesToConsider) {
            totalCredits += semesterGrades[m].credits
        }

        // Total the grade using the total of the credits to find the proportion of the grade
        // to the overall system
        let finalGrade = 0
        for (const m of modulesToConsider) {
            finalGrade += semesterGrades[m].grade * (semesterGrades[m].credits / totalCredits)
        }

        // Save the result
        results.push({
            remove: group,
            grade: finalGrade,
        });
    }

    // And then return it
    return results;
}

/**
 * Converts the result of the calculator to be displayed in the DOM. 
 * @param {{grade: number, remove: string[]}[]} results the results of the calculator
 * @param {boolean} semesterOne if this calculation was run against semester one
 */
function renderResult(results, semesterOne) {
    // Find where we're going to insert the content and prepare it. This changes depending on which
    // semester we're in
    const target = semesterOne ? document.querySelector('#sem1-result') : document.querySelector('#sem2-result');
    target.innerHTML = `<h2>Semester ${semesterOne ? 'One' : 'Two'}</h2>`;

    // Calculate the grade that they get if you don't remove anythin.g This was not implemented nicely in the calculator
    // so we just look for the record with nothing removed and just assume it exists (remove the possibility of find removing
    // undefined) and then apply the grade calculation
    const baseGrade = Math.round(results.find((e) => e.remove.length === 0).grade * 100) / 100;

    // Sort the results list by the grade so we can display the highest grade possible at the top
    results = results.sort((a, b) => b.grade - a.grade);

    // For each possible module combination that can be removed, go through it and display it
    results.forEach(({ remove, grade }) => {
        // Create a new entry
        const entry = document.createElement('div');
        entry.classList.add('result-entry');

        // Produce a container for the list of modules that have been removed, this applies nice styling
        const removed = document.createElement('div');
        removed.classList.add('removed');

        // Removed can be multiple so each one needs to be inserted
        remove.forEach((d) => {
            const code = document.createElement('div');

            code.classList.add('code');
            code.innerText = d;

            removed.appendChild(code);
        });

        // If nothing was removed, we need a way to indicate that so display it like a module code but
        // with 'nothing' inside instead.
        if (remove.length === 0) {
            const nothing = document.createElement('div');
            nothing.classList.add('code');
            nothing.innerText = 'nothing';
            removed.appendChild(nothing);
        }

        // Explanations are static but still need generating
        const explain = document.createElement('div');
        explain.innerText = 'By SP coding';
        const explain2 = document.createElement('div');
        explain2.classList.add('explain-grade')
        explain2.innerText = 'your grade becomes';

        // Round the grade result to 2 decimal places and set up the DOM element
        const rounded = Math.round(grade * 100) / 100
        const calc = document.createElement('div');
        calc.classList.add('grade');
        calc.innerText = rounded;

        // Set the colour based on whether the grade is better, worse or equal
        if (rounded > baseGrade) calc.classList.add('better');
        else if (rounded < baseGrade) calc.classList.add('worse');

        // Create a spacer region which is used to improve readability
        const space = document.createElement('div');
        space.classList.add('space');

        // The left hand side contains the explanations and the list of modules which were removed
        const left = document.createElement('div');
        left.classList.add('left');
        left.appendChild(explain);
        left.appendChild(removed);

        // Insert everything into the entry
        entry.appendChild(left);
        entry.appendChild(explain2);
        entry.appendChild(space);
        entry.appendChild(calc);

        // And then add the entry to the target
        target.appendChild(entry);
    });
}

/**
 * Executes the SP Code calculation. It will convert the form and then filter out the S1 and S2
 * modules and run and render the calculator to the DOM. 
 */
function executeSPCodeCalculation() {
    const modules = convertFormToModuleArray();

    // Filter out modules in a specific semester.
    // Then map each record into a module object which is expected by the calculator
    // And finally reduce them all down into a single object which we can pass into the calculator
    const semesterOneModules = modules.filter((a) => a.semester === 'sem1')
        .map((m) => ({ [m.moduleCode]: m }))
        .reduce((a, b) => ({ ...a, ...b }), {});
    const semesterTwoModules = modules.filter((a) => a.semester === 'sem2')
        .map((m) => ({ [m.moduleCode]: m }))
        .reduce((a, b) => ({ ...a, ...b }), {});

    const semesterOneResults = calculateSemester(semesterOneModules);
    const semesterTwoResults = calculateSemester(semesterTwoModules);

    unwarn();

    renderResult(semesterOneResults, true);
    renderResult(semesterTwoResults, false);
}

/**
 * Waits for the VanillaRecyclerView to be defined and then resolves the promise. This ensures the system
 * is ready for use
 * @returns {Promise}
 */
function waitForRecycler(){
    return new Promise(function(res) {
        const asyncInterval = setInterval(() => {
            if (typeof (VanillaRecyclerView) !== 'undefined') {
                clearInterval(asyncInterval);
                res();
            }
        });
    });
}

/**
 * Produces the recycler element for the search using the recycler* functions.
 */
function createRecycler() {
    const moduleListElement = document.querySelector('#module-entries');
    moduleRecycler = new VanillaRecyclerView(moduleListElement, {
        data: moduleCache,
        size: recyclerCalculateElementSize,
        renderer: class {
            initialize(params) {
                this.layout = recyclerInitializeElement(params);
            }
            getLayout() {
                return this.layout;
            }
            onMount(params) {
                recyclerMountElement(params, this.layout);
                return true;
            }
            onUnmount() {
                recyclerUnmount(this.layout);
            }
        },
    });
}

// ==================
// = Main Execution =
// ==================

/**
 * This works out whether to close the dropdown menu based on where the user clicks
 * @param {MouseEvent} e the mouse event on the DOM
 */
document.onclick = (e) => {
    const dropdown = document.querySelector('#module-entries');
    if(!e.target.classList.contains('module') && !dropdown.contains(e.target)) {
        hideDropdown();
    }
}

/**
 * Adds a new module row whenever the user clicks the add button
 */
document.getElementById('add').onclick = cloneAndInsertModuleRow;

/**
 * When the user hits submit, execute the SP code calculations
 */
document.getElementById('submit').onclick = executeSPCodeCalculation;

/**
 * Wait for the recycler to be ready, load the modules and then add the first one for the user to edit
 */
Promise.all([
    waitForRecycler(),
    loadModules(),
]).then(function(){
    createRecycler();
    updateModuleList("");
    cloneAndInsertModuleRow();
});