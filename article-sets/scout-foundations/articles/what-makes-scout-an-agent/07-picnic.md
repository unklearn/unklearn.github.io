Add movement, pantry inspection, pickup, and delivery. Scout chooses the sequence; the tools enforce distance, stock, and what it carries.

Run the default order with **two apples**, then change only the preset to **one apple** and run again. Mock learns the counts through `inspect_pantry`: it takes an apple in the first take and a carrot in the second.

Inspection uses the same feedback pattern:

{{source:feedback}}

Pause after inspection to try one more experiment: **empty the apple shelf**, then Continue. Scout’s last observation still says two apples. The real pickup fails with `out_of_stock`; the failure becomes feedback, and Mock inspects again before choosing a carrot.

Taking the last apple is legal. “Leave at least one” belongs to the posted instruction, not the world rules. Live may make a different decision; the basket and trace preserve what it actually did.
