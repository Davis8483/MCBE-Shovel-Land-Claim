import { Player, RawMessage } from '@minecraft/server';
import { ActionFormData, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

/**
 * A wrapper class for ActionFormData that allows for callback functions to be passed in for button actions.
 */
export class CallbackActionFormData {
    private form: ActionFormData;
    private callbacks: Array<{ callback: () => void }> = [];

    constructor() {
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

    constructor() {
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
     * @param defaultValue - The default value for the text input (optional).
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public textField(label: RawMessage, placeholder: RawMessage, defaultValue?: string, callback?: (value: string | RawMessage) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.textField(label, placeholder, defaultValue);
        this.formConstruction.push({ data: [label, placeholder, defaultValue], callback: (data) => this.textField(data[0], data[1], data[2], callback), isInputField: true });
        return this;
    }

    /**
     * Adds a toggle to the form with a callback function.
     * 
     * @param label - The label for the toggle.
     * @param defaultValue - The default value for the toggle (optional).
     * @param callback - The function to call when the button is pressed (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public toggle(label: RawMessage, defaultValue?: boolean, callback?: (value: boolean) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.toggle(label, defaultValue);
        this.formConstruction.push({ data: [label, defaultValue], callback: (data) => this.toggle(data[0], data[1], callback), isInputField: true });
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
    public dropdown(label: RawMessage, options: RawMessage[], defaultValueIndex?: number, callback?: (value: RawMessage) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.dropdown(label, options, defaultValueIndex);
        this.formConstruction.push({ data: [label, options, defaultValueIndex], callback: (data) => this.dropdown(data[0], data[1], data[2], callback), isInputField: true });
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
     * @param defaultValue - The default value for the slider (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public slider(label: RawMessage, minimumValue: number, maximumValue: number, valueStep: number, defaultValue?: number, callback?: (value: number) => ModalDataCorrect | ModalDataError): this {
        this.callbacks.push({ callback: callback || (() => new ModalDataCorrect()) });
        this.form.slider(label, minimumValue, maximumValue, valueStep, defaultValue);
        this.formConstruction.push({ data: [label, minimumValue, maximumValue, valueStep, defaultValue], callback: (data) => this.slider(data[0], data[1], data[2], data[3], data[4], callback), isInputField: true });
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
     * Shows the modal form to the player and executes the callback of the selected button.
     * 
     * @param player - The player to show the form to.
     */
    public show(player: Player): void {
        this.form.show(player).then((response) => {
            var hasError = false;

            if (!response.canceled) {
                for (var i = 0; i < response.formValues.length; i++) {
                    const value = response.formValues[i];
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
                    this.formConstruction.forEach((field) => {
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