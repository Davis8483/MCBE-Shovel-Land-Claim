import { Player, RawMessage } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

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
    public title(titleText: RawMessage | string): this {
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
    public button(text: RawMessage | string, iconPath?: string, callback?: () => void): this {
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
    public body(text: RawMessage | string): this {
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
 * A wrapper class for ModalFormData that allows for callback functions to be passed in for button actions.
 */
export class CallbackModalFormData {
    private form: ModalFormData;
    private callbacks: Array<{ callback: (formValue: string | RawMessage | number | boolean) => void }> = [];
    private submitCallback: (() => void) = () => {};

    constructor() {
        this.form = new ModalFormData();
    }

    /**
     * Adds the form title.
     * 
     * @param titleText - The title of the form.
     * @return - The current instance of the form for method chaining.
     */
    public title(titleText: RawMessage | string): this {
        this.form.title(titleText);
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
    public textField(label: RawMessage | string, placeholder: RawMessage | string, defaultValue?: RawMessage | string, callback?: (value: RawMessage | string) => void): this {
        this.callbacks.push({ callback: callback || (() => {}) });
        this.form.textField(label, placeholder, defaultValue);
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
    public toggle(label: RawMessage | string, defaultValue?: boolean, callback?: (value: boolean) => void): this {
        this.callbacks.push({ callback: callback || (() => {}) });
        this.form.toggle(label, defaultValue);
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
    public dropdown(label: RawMessage | string, options: (RawMessage | string)[], defaultValueIndex?: number, callback?: (value: RawMessage | string) => void): this {
        this.callbacks.push({ callback: callback || (() => {}) });
        this.form.dropdown(label, options, defaultValueIndex);
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
    public slider(label: RawMessage | string, minimumValue: number, maximumValue: number, valueStep: number, defaultValue?: number, callback?: (value: number) => void): this {
        this.callbacks.push({ callback: callback || (() => {}) });
        this.form.slider(label, minimumValue, maximumValue, valueStep, defaultValue);
        return this;
    }

    /**
     * Adds the submit button to the form
     *
     * * @param text - The text to display on the button.
     */
    public submitButton(text: RawMessage | string, callback?: () => void): this {
        this.form.submitButton(text);
        this.submitCallback = callback || (() => {});
        return this;
    }

    /**
     * Shows the modal form to the player and executes the callback of the selected button.
     * 
     * @param player - The player to show the form to.
     */
    public show(player: Player): void {
        this.form.show(player).then((result) => {
            if (!result.canceled) {
                for (var i = 0; i < result.formValues.length; i++) {
                    const value = result.formValues[i];
                    this.callbacks[i].callback(value);
                }
                this.submitCallback();
            }
        });
    }
}