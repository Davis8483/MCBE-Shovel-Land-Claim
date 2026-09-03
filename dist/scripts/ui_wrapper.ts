import { Player, RawMessage } from '@minecraft/server';
import { ActionFormData, ModalFormData, ModalFormResponse, MessageFormData, ModalFormDataTextFieldOptions, ModalFormDataToggleOptions, ModalFormDataDropdownOptions, ModalFormDataSliderOptions } from '@minecraft/server-ui';


export class NavigationStack {
    stack: (() => void)[] = []; // Stack to manage back navigation

    /**
     * Used to navigate to the previous menu in the stack.
     */
    public back(): void {
        if (this.stack.length > 0) { 
            this.stack.pop(); // Remove the last screen from the stack

            this.showCurrent(); // Now show the previous screen
        }
    }

    /**
     * Pushes a new screen onto the navigation stack.
     * 
     * @param callback - The function call that shows the current menu.
     */
    public push(callback: () => void): void {
        this.stack.push(callback); // Push the callback function to the stack
    }

    /**
     * Removes the last screen from the navigation stack.
     */
    public pop(): void {
        this.stack.pop(); // Remove the last screen from the stack
    }

    /**
     * Clears the navigation stack.
     */
    public clear(): void {
        this.stack = []; // Clear the navigation stack
    }

    /**
     * Shows the current screen in the navigation stack.
     */
    public showCurrent(): void {
        if (this.stack.length > 0) {
            const previousScreen = this.stack.pop(); // get the last screen in the stack
            if (previousScreen) {
                previousScreen(); // Call the function to show the current screen
            }
        }
    }

    public get length(): number {
        return this.stack.length;
    }
}

export class CallbackActionFormData {
    private form: ActionFormData;
    private callbacks: Array<{callback: () => void}> = [];

    /**
     * A wrapper class for ActionFormData that allows for callback functions to be passed in for button actions.
     * 
     * tbh, the navigation stack could be handeled outside of this class but I don't want you to forget about it ❤️
     * 
     * @param navigationStack - The navigation stack to manage back navigation.
     * @param navigationCallback - The callback function to navigate back to this menu.
     */
    constructor(navigationStack: NavigationStack, navigationCallback: () => void) {
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

// Unified form element types that handle both data and positioning
interface BaseFormElement {
    elementType: string;
    isInputField: boolean;
    state: ModalDataCorrect | ModalDataError;
}

interface TitleElement extends BaseFormElement {
    elementType: 'title';
    data: RawMessage;
    isInputField: false;
}

interface LabelElement extends BaseFormElement {
    elementType: 'label';
    data: RawMessage;
    isInputField: false;
}

interface DividerElement extends BaseFormElement {
    elementType: 'divider';
    isInputField: false;
}

interface HeaderElement extends BaseFormElement {
    elementType: 'header';
    data: RawMessage;
    isInputField: false;
}

interface SubmitButtonElement extends BaseFormElement {
    elementType: 'submitButton';
    data: RawMessage;
    isInputField: false;
}

interface TextFieldElement extends BaseFormElement {
    elementType: 'textField';
    label: RawMessage;
    placeholder: RawMessage;
    options?: ModalFormDataTextFieldOptions;
    callback?: (value: string | RawMessage) => ModalDataCorrect | ModalDataError;
    isInputField: true;
}

interface ToggleElement extends BaseFormElement {
    elementType: 'toggle';
    label: RawMessage;
    options?: ModalFormDataToggleOptions;
    callback?: (value: boolean) => ModalDataCorrect | ModalDataError;
    isInputField: true;
}

interface DropdownElement extends BaseFormElement {
    elementType: 'dropdown';
    label: RawMessage;
    dropdownOptions: RawMessage[];
    options?: ModalFormDataDropdownOptions;
    callback?: (value: number) => ModalDataCorrect | ModalDataError;
    isInputField: true;
}

interface SliderElement extends BaseFormElement {
    elementType: 'slider';
    label: RawMessage;
    minimumValue: number;
    maximumValue: number;
    options?: ModalFormDataSliderOptions;
    callback?: (value: number) => ModalDataCorrect | ModalDataError;
    isInputField: true;
}

type FormElement = TitleElement | LabelElement | DividerElement | HeaderElement | SubmitButtonElement | TextFieldElement | ToggleElement | DropdownElement | SliderElement;
type InputFormElement = TextFieldElement | ToggleElement | DropdownElement | SliderElement;

export class CallbackModalFormData {
    private form: ModalFormData;
    private errorSoundId: string;
    private formElements: FormElement[] = []; // Single ordered list maintaining sequence
    private submitCallback: ((response: ModalFormResponse) => void) = () => {};

    /**
     * A wrapper class for ModalFormData that allows for callback functions to be passed in for button actions.
     * 
     * tbh, the navigation stack could be handeled outside of this class but I don't want you to forget about it ❤️
     * 
     * @param errorSoundId - The in game sound ID to play when a players input has an error causing the form to re-show.
     * @param navigationStack - The navigation stack to manage back navigation.
     * @param navigationCallback - The callback function to navigate back to this menu.
     */
    constructor(errorSoundId: string, navigationStack: NavigationStack, navigationCallback: () => void) {
        navigationStack.push(navigationCallback); // Push the return callback to the stack
        this.errorSoundId = errorSoundId;
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
        this.formElements.push({ elementType: 'title', data: titleText, isInputField: false, state: new ModalDataCorrect() });
        return this;
    }

    /**
     * Adds a text input to the form with a callback function.
     * 
     * @param label - The label for the text input.
     * @param placeholder - The placeholder text for the text input.
     * @param textFieldOptions - The default value for the text input (optional).
     * @param callback - Verify the input and return a ModalDataCorrect or ModalDataError (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public textField(label: RawMessage, placeholder: RawMessage, textFieldOptions?: ModalFormDataTextFieldOptions, callback?: (value: string | RawMessage) => ModalDataCorrect | ModalDataError): this {
        const element: TextFieldElement = {
            elementType: 'textField',
            label,
            placeholder,
            options: textFieldOptions,
            callback: callback || (() => new ModalDataCorrect()),
            isInputField: true,
            state: new ModalDataCorrect()
        };
        this.formElements.push(element);
        this.form.textField(label, placeholder, textFieldOptions);
        return this;
    }

    /**
     * Adds a toggle to the form with a callback function.
     * 
     * @param label - The label for the toggle.
     * @param toggleOptions - The default value for the toggle (optional).
     * @param callback - Verify the input and return a ModalDataCorrect or ModalDataError (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public toggle(label: RawMessage, toggleOptions?: ModalFormDataToggleOptions, callback?: (value: boolean) => ModalDataCorrect | ModalDataError): this {
        const element: ToggleElement = {
            elementType: 'toggle',
            label,
            options: toggleOptions,
            callback: callback || (() => new ModalDataCorrect()),
            isInputField: true,
            state: new ModalDataCorrect()
        };
        this.formElements.push(element);
        this.form.toggle(label, toggleOptions);
        return this;
    }

    /**
     * Adds a dropdown to the form with a callback function.
     * 
     * @param label - The label for the dropdown.
     * @param options - The options for the dropdown.
     * @param defaultValue - The default value for the dropdown (optional).
     * @param callback - Verify the input and return a ModalDataCorrect or ModalDataError (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public dropdown(label: RawMessage, options: RawMessage[], dropdownOptions?: ModalFormDataDropdownOptions, callback?: (value: number) => ModalDataCorrect | ModalDataError): this {
        const element: DropdownElement = {
            elementType: 'dropdown',
            label,
            dropdownOptions: options,
            options: dropdownOptions,
            callback: callback || (() => new ModalDataCorrect()),
            isInputField: true,
            state: new ModalDataCorrect()
        };
        this.formElements.push(element);
        this.form.dropdown(label, options, dropdownOptions);
        return this;
    }

    /**
     * Adds a slider to the form with a callback function.
     * 
     * @param label - The label for the slider.
     * @param minimumValue - The minimum value for the slider.
     * @param maximumValue - The maximum value for the slider.
     * @param callback - Verify the input and return a ModalDataCorrect or ModalDataError (optional).
     * @param sliderOptions - The optional additional values for the slider creation.
     * @returns - The current instance of the form for method chaining.
     */
    public slider(label: RawMessage, minimumValue: number, maximumValue: number, sliderOptions?: ModalFormDataSliderOptions, callback?: (value: number) => ModalDataCorrect | ModalDataError): this {
        const element: SliderElement = {
            elementType: 'slider',
            label,
            minimumValue,
            maximumValue,
            options: sliderOptions,
            callback: callback || (() => new ModalDataCorrect()),
            isInputField: true,
            state: new ModalDataCorrect()
        };
        this.formElements.push(element);
        this.form.slider(label, minimumValue, maximumValue, sliderOptions);
        return this;
    }

    /**
     * Adds the submit button to the form
     *
     * @param text - The text to display on the button.
     * @param callback - The function to call when the form is submitted (optional).
     * @returns - The current instance of the form for method chaining.
     */
    public submitButton(text: RawMessage, callback?: (response: ModalFormResponse) => void) {
        this.form.submitButton(text);
        this.submitCallback = callback || ((ModalFormResponse) => {});
        this.formElements.push({ elementType: 'submitButton', data: text, isInputField: false, state: new ModalDataCorrect() });
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
        this.formElements.push({ elementType: 'label', data: text, isInputField: false, state: new ModalDataCorrect() });
        return this;
    }

    /**
     * Creates a divider in the form.
     * 
     * @returns - The current instance of the form for method chaining.
     */
    public divider(): this {
        this.form.divider();
        this.formElements.push({ elementType: 'divider', isInputField: false, state: new ModalDataCorrect() });
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
        this.formElements.push({ elementType: 'header', data: text, isInputField: false, state: new ModalDataCorrect() });
        return this;
    }

    /**
     * Type-safe helper to update field options with error values
     */
    private updateFieldOptionsWithValue(element: InputFormElement, value: any): void {
        switch (element.elementType) {
            case 'textField':
                if (element.options) {
                    element.options.defaultValue = value as string;
                }
                break;
            case 'toggle':
                if (element.options) {
                    element.options.defaultValue = value as boolean;
                }
                break;
            case 'dropdown':
                if (element.options) {
                    element.options.defaultValueIndex = value as number;
                }
                break;
            case 'slider':
                if (element.options) {
                    element.options.defaultValue = value as number;
                }
                break;
        }
    }

    /**
     * Type-safe helper to rebuild the form from stored element definitions in exact order
     */
    private rebuildForm(): void {
        this.form = new ModalFormData();
        
        // Rebuild all elements in the exact order they were added
        for (const element of this.formElements) {

            // Any error messages should be added to the rawtext of the label
            const errorMsg: RawMessage[] = element.state instanceof ModalDataError ? [{ text: "\n" }, { translate: element.state.errorMessage }] : [];

            switch (element.elementType) {
                case 'title':
                    this.form.title(element.data);
                    break;
                case 'label':
                    this.form.label(element.data);
                    break;
                case 'divider':
                    this.form.divider();
                    break;
                case 'header':
                    this.form.header(element.data);
                    break;
                case 'submitButton':
                    this.form.submitButton(element.data);
                    break;
                case 'textField':
                    this.form.textField({ rawtext: [element.label, ...errorMsg] }, element.placeholder, element.options);
                    break;
                case 'toggle':
                    this.form.toggle({ rawtext: [element.label, ...errorMsg] }, element.options);
                    break;
                case 'dropdown':
                    this.form.dropdown({ rawtext: [element.label, ...errorMsg] }, element.dropdownOptions, element.options);
                    break;
                case 'slider':
                    this.form.slider({ rawtext: [element.label, ...errorMsg] }, element.minimumValue, element.maximumValue, element.options);
                    break;
            }
        }
    }

    /**
     * Type-safe helper to call field callback with proper typing
     */
    private callFieldCallback(element: InputFormElement, value: any): ModalDataCorrect | ModalDataError {
        if (!element.callback) {
            return new ModalDataCorrect();
        }

        switch (element.elementType) {
            case 'textField':
                return element.callback(value as string | RawMessage);
            case 'toggle':
                return element.callback(value as boolean);
            case 'dropdown':
                return element.callback(value as number);
            case 'slider':
                return element.callback(value as number);
            default:
                return new ModalDataCorrect();
        }
    }

    /**
     * Shows the modal form to the player and executes the callback of the selected button.
     * 
     * @param player - The player to show the form to.
     */
    public show(player: Player): void {
        this.form.show(player).then((response) => {

            if (!response.canceled) {
                // list of values that have been filled out by the player
                const formValues = response.formValues.filter(value => value !== undefined && value !== null);
                
                // Get only the input field elements to match with form values
                const inputElements = this.formElements.filter(element => element.isInputField) as InputFormElement[];
                
                for (var i = 0; i < formValues.length && i < inputElements.length; i++) {
                    const value = formValues[i];
                    const element = inputElements[i];
                    const fieldReturnState = this.callFieldCallback(element, value);

                    // update state so if errors are present a message can be inserted
                    element.state = fieldReturnState;

                    // Update the field options with the current value for reshowing; if there is an error that is!
                    this.updateFieldOptionsWithValue(element, value);
                }
                
                // If any field returned an error, rebuild and reshow the form
                if (inputElements.some(element => element.state instanceof ModalDataError)) {
                    // Play the error sound
                    player.playSound(this.errorSoundId);

                    this.rebuildForm();
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
     * A wrapper class for MessageFormData that allows for callback functions to be passed in for button actions.
     * 
     * tbh, the navigation stack could be handeled outside of this class but I don't want you to forget about it ❤️
     * 
     * @param navigationStack - The navigation stack to manage back navigation.
     * @param navigationCallback - The callback function to navigate back to this menu.
     */
    constructor(navigationStack: NavigationStack, navigationCallback: () => void) {
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