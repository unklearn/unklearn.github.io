Run a turn with `read_notice` available. When Scout requests it, the harness looks up the selected handler and executes it.

{{source:execute}}

Watch the board’s light switch off. Open the activity notification to inspect the returned notice. Then we pause.

The result is now a JavaScript value. **The model has not received it.** Returning from a function does not change the input to the next model call.
