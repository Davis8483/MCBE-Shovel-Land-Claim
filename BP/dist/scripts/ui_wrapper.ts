import { Player, RawMessage, world } from '@minecraft/server';
import { ActionFormData, ModalFormData, ModalFormResponse, MessageFormData, ModalFormDataTextFieldOptions, ModalFormDataToggleOptions, ModalFormDataDropdownOptions, ModalFormDataSliderOptions } from '@minecraft/server-ui';

var navigationStack: (() => void)[] = []; // Stack to manage back navigation

/**
 * Used to navigate to the previous menu in the stack.
 */
export function navigateBack(): void {
    if (navigationStack.length > 0) { 
        navigationStack.pop(); // Remove the last screen from the stack

        const previousScreen = navigationStack.pop(); // Get the previous screen
        if (previousScreen) {
            previousScreen(); // Call the function to show the previous screen
        }
    }
}

/**
 * Removes the last screen from the navigation stack.
 */
export function popNavigationStack(): void {
    navigationStack.pop(); // Remove the last screen from the stack
}

/**
 * Clears the navigation stack.
 */
export function clearNavigationStack(): void {
    navigationStack = []; // Clear the navigation stack
};

/**
 * A wrapper class for ActionFormData that allows for callback functions to be passed in for button actions.
 */
export class CallbackActionFormData {
    private form: ActionFormData;
    private callbacks: Array<{callback: () => void}> = [];

    /**
     * @param navigationCallback - The callback function to navigate back to this menu.
     */
    constructor(navigationCallback: () => void) {
        navigationStack.push(navigationCallback); // Push the return callback to the stack
        this.form = new ActionFormData();
    }

    /**
     * Adds the form title.
     * 
     * @param titleText - The title of the form.
     * @return - The current instance of the form for method chaining.
     */
    public title(titleText: RawMessage): this {
        this.form.title(titleText);
        return this;
    }

    /**
     * Adds a button to the form with a callback function.
     * 
     * @param text - The text to display on the button.
     * @param iconPath - The icon path for the button (optional).
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public button(text: RawMessage, iconPath?: string, callback?: () => void): this {
        this.callbacks.push({ callback: callback || (() => {}) });
        this.form.button(text, iconPath);
        return this;
    }

    /**
     * Sets the body of the form.
     * 
     * @param text - The text to set as the body of the form.
     * @returns - The current instance of the form for method chaining.
     */
    public body(text: RawMessage): this {
        this.form.body(text);
        return this;
    }

    /**
     * Creates a label in the form.
     * 
     * @param text - The text to set as the label of the form.
     * @returns - The current instance of the form for method chaining.
     */
    public label(text: RawMessage): this {
        this.form.label(text);
        return this;
    }

    /**
     * Creates a divider in the form.
     * 
     * @returns - The current instance of the form for method chaining.
     */
    public divider(): this {
        this.form.divider();
        return this;
    }

    /**
     * Creates a header in the form.
     * 
     * @param text - The text to set as the header of the form.
     * @returns - The current instance of the form for method chaining.
     */
    public header(text: RawMessage): this {
        this.form.header(text);
        return this;
    }

    /**
     * Shows the action form to the player and executes the callback of the selected button.
     * 
     * @param player - The player to show the form to.
     */
    public show(player: Player): void {
        this.form.show(player).then((result) => {
            if (!result.canceled) {
                this.callbacks[result.selection].callback();
            }
        });
    }
}

/**
 * A class representing that a modal form field was filled out incorrectly.
 * 
 * @param errorMessage - The error message to display above the field. Should be a translation key.
 */
export class ModalDataError {
    public errorMessage: string;

    constructor(errorMessage: string) {
        this.errorMessage = errorMessage;
    }
}

/**
 * A class representing that a modal form field was filled out correctly.
 */
export class ModalDataCorrect {}

/**
 * A wrapper class for ModalFormData that allows for callback functions to be passed in for button actions.
 */
export class CallbackModalFormData {
    private form: ModalFormData;
    private formConstruction: Array<{ data: Array<any>, callback: (data: any) => void, isInputField: boolean}> = []; // Logs all methods used to create the form so it can be recreated if theres an error in fields.
    private callbacks: Array<{ callback: (formValue: string | RawMessage | number | boolean) => ModalDataCorrect | ModalDataError }> = [];
    private submitCallback: ((response: ModalFormResponse) => void) = () => {};

    /**
     * @param backCallback - The callback function to navigate back to this menu.
     */
    constructor(backCallback: () => void) {
        navigationStack.push(backCallback); // Push the return callback to the stack
        this.form = new ModalFormData();
    }

    /**
     * Adds the form title.
     * 
     * @param titleText - The title of the form.
     * @return - The current instance of the form for method chaining.
     */
    public title(titleText: RawMessage): this {
        this.form.title(titleText);
        this.formConstruction.push({ data: [titleText], callback: (data) => this.title(data[0]), isInputField: false });
        return this;
    }

    /**
     * Adds a text input to the form with a callback function.
     * 
     * @param label - The label for the text input.
     * @param placeholder - The placeholder text for the text input.
     * @param textFieldOptions - The default value for the text input (optional).
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public textField(label: RawMessage, placeholder: RawMessage, textFieldOptions?: ModalFormDataTextFieldOptions, callback?: (value: string | RawMessage) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.textField(label, placeholder, textFieldOptions);
        this.formConstruction.push({ data: [label, placeholder, textFieldOptions], callback: (data) => this.textField(data[0], data[1], data[2], callback), isInputField: true });
        return this;
    }

    /**
     * Adds a toggle to the form with a callback function.
     * 
     * @param label - The label for the toggle.
     * @param toggleOptions - The default value for the toggle (optional).
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public toggle(label: RawMessage, toggleOptions?: ModalFormDataToggleOptions, callback?: (value: boolean) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.toggle(label, toggleOptions);
        this.formConstruction.push({ data: [label, toggleOptions], callback: (data) => this.toggle(data[0], data[1], callback), isInputField: true });
        return this;
    }

    /**
     * Adds a dropdown to the form with a callback function.
     * 
     * @param label - The label for the dropdown.
     * @param options - The options for the dropdown.
     * @param defaultValue - The default value for the dropdown (optional).
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public dropdown(label: RawMessage, options: RawMessage[], dropdownOptions?: ModalFormDataDropdownOptions, callback?: (value: number) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.dropdown(label, options, dropdownOptions);
        this.formConstruction.push({ data: [label, options, dropdownOptions], callback: (data) => this.dropdown(data[0], data[1], data[2], callback), isInputField: true });
        return this;
    }

    /**
     * Adds a slider to the form with a callback function.
     * 
     * @param label - The label for the slider.
     * @param minimumValue - The minimum value for the slider.
     * @param maximumValue - The maximum value for the slider.
     * @param valueStep - The step value for the slider.
     * @param callback - The function to call when the button is pressed (optional).
     * @param sliderOptions - The default value for the slider (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public slider(label: RawMessage, minimumValue: number, maximumValue: number, sliderOptions?: ModalFormDataSliderOptions, callback?: (value: number) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.slider(label, minimumValue, maximumValue, sliderOptions);
        this.formConstruction.push({ data: [label, minimumValue, maximumValue, sliderOptions], callback: (data) => this.slider(data[0], data[1], data[2], data[3], callback), isInputField: true });
        return this;
    }

    /**
     * Adds the submit button to the form
     *
     * * @param text - The text to display on the button.
     */
    public submitButton(text: RawMessage, callback?: (response: ModalFormResponse) => void) {
        this.form.submitButton(text);
        this.submitCallback = callback || ((ModalFormResponse) => {});
        this.formConstruction.push({ data: [text], callback: (data) => this.submitButton(data[0], callback), isInputField: false });
        return this;
    }

    /**
     * Creates a label in the form.
     * 
     * @param text - The text to set as the label of the form.
     * @returns - The current instance of the form for method chaining.
     */
    public label(text: RawMessage): this {
        this.form.label(text);
        this.formConstruction.push({ data: [text], callback: (data) => this.label(data[0]), isInputField: false });
        return this;
    }

    /**
     * Creates a divider in the form.
     * 
     * @returns - The current instance of the form for method chaining.
     */
    public divider(): this {
        this.form.divider();
        this.formConstruction.push({ data: [], callback: () => this.divider(), isInputField: false });
        return this;
    }

    /**
     * Creates a header in the form.
     * 
     * @param text - The text to set as the header of the form.
     * @returns - The current instance of the form for method chaining.
     */
    public header(text: RawMessage): this {
        this.form.header(text);
        this.formConstruction.push({ data: [text], callback: (data) => this.header(data[0]), isInputField: false });
        return this;
    }

    /**
     * Shows the modal form to the player and executes the callback of the selected button.
     * 
     * @param player - The player to show the form to.
     */
    public show(player: Player): void {
        this.form.show(player).then((response) => {
            var hasError = false;

            if (!response.canceled) {
                const formValues = response.formValues.filter(value => value !== undefined && value !== null); // Filter out undefined or null values
                
                for (var i = 0; i < formValues.length; i++) {
                    const value = formValues[i];
                    const fieldReturnState = this.callbacks[i].callback(value);

                    if (fieldReturnState instanceof ModalDataError) {
                        hasError = true; // set flag to reshow form
                        var label = this.formConstruction.filter(field => field.isInputField)[i].data[0] as RawMessage; // get label of field
                        
                        // adds error message to the field label as a newline
                        this.formConstruction.filter(field => field.isInputField)[i].data[0] = { 
                            "rawtext": [
                                label, // Assuming `label` is already a valid RawMessage
                                { "text": "\n" } as RawMessage,
                                { "translate": fieldReturnState.errorMessage } as RawMessage
                            ] 
                        };

                    }
                }
                // if any field returned an error, reshow the form with the error messages
                if (hasError) {
                    this.form = new ModalFormData(); // reset form

                    // make a copy of the form construction array
                    const formConstructionCopy = this.formConstruction.map((field) => {
                        return { ...field };
                    });

                    // reset the form construction array
                    this.formConstruction = [];

                    // recreate the form using the copied array
                    formConstructionCopy.forEach((field) => {
                        field.callback(field.data);
                    });
                    this.show(player); // reshow form
                    return;
                }
                else {
                    this.submitCallback(response);
                }
            }
        });
    }
}

export class CallbackMessageFormData {
    private form: MessageFormData;
    private callbacks: Array<{ callback: () => void }> = [];

    /**
     * * A wrapper class for MessageFormData that allows for callback functions to be passed in for button actions.
     * 
     * @param navigationCallback - The callback function to navigate back to this menu.
     */
    constructor(navigationCallback: () => void) {
        navigationStack.push(navigationCallback); // Push the return callback to the stack
        this.form = new MessageFormData();
    }

    /**
     * Adds the form title.
     * 
     * @param titleText - The title of the form.
     * @returns - The current instance of the form for method chaining.
     */
    public title(titleText: RawMessage): this {
        this.form.title(titleText);
        return this;
    }

    /**
     * Adds the form body.
     * 
     * @param text - The text to display in the body of the form.
     * @returns - The current instance of the form for method chaining.
     */
    public body(text: RawMessage): this {
        this.form.body(text);
        return this;
    }

    /**
     * Adds a button to the form with a callback function.
     * 
     * @param text - The text to display on the button.
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public button1(text: RawMessage, callback?: () => void): this {
        this.callbacks.push({ callback: callback || (() => {}) });
        this.form.button1(text);
        return this;
    }

    /**
     * Adds a button to the form with a callback function.
     * 
     * @param text - The text to display on the button.
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public button2(text: RawMessage, callback?: () => void): this {
        this.callbacks.push({ callback: callback || (() => {}) });
        this.form.button2(text);
        return this;
    }

    /**
     * Shows the message form to the player.
     * 
     * @param player - The player to show the form to.
     */
    public show(player: Player): void {
        this.form.show(player).then((result) => {
            if (!result.canceled) {
                this.callbacks[result.selection].callback();
            }
        });
    }
}