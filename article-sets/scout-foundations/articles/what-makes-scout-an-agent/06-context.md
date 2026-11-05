Keep the assistant’s tool request and append its matching result to the conversation:

{{source:feedback}}

Now make another evaluation:

{{source:evaluate}}

Open the activity notification’s Context tab to inspect the outgoing message containing the exact notice. This is the point where the model can respond to the order itself.

An agent combines a **model and a harness**. The model selects an action. The harness exposes tools, runs the selected handler, carries its observation forward, and decides when to allow another turn. The feedback makes the next decision informed by what happened.
