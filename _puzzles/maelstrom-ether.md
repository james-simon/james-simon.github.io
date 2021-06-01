---
layout: solpage
type: solution
title: Maelstrom
flavortext: This whirlpool's just claimed a hapless ship. All that's left are a few bits and pieces tangled in the rigging, making circuits 'round the center.
origin: VT Hunt 2021
answer: ether
---

With this puzzle, as with many, the clearest pattern is the place to start. In contrast to the tangle of rope and oars in the puzzle’s core, the life rings around its circumference show clear structure. The rings on the right are each marked with eight stripes which, with white as 1 and black as 0, all match an ASCII letter; clockwise, they read “MNESOTAQHUINITEDER.” The rings on the left, then, are each marked with a single binary bit. These bits are key to making sense of the haphazard ropes at the center of the puzzle.

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.imgurl}}/maelstromsol1.png" width="100%" />
</p>

Despite the ropes’ disorder, some key patterns stand out clearly. There are small knots throughout. The oars are sometimes single and sometimes crossed in a pair, and in either case, they’re attached to ropes in the same way, with two ropes on one side and one on the other. No rope ends on anything but an oar or a life ring.

The trick is to realize that the entire puzzle is a logic circuit, as the flavortext hints. Knots correspond to NOT gates, oars are ORs, and the network of ropes are the wires. As is typical with logic circuits, the input bits are on the left, and the logical operations propagate the input rightwards to the output wires. The two inputs to a two-bit gate were on the same side of the oar, lining up with the typical symbols for two-bit logic gates.

With this insight, Hunters could carefully solve the complex circuit, propagating bits gate by gate through the circuit until each lettered life ring is given either a zero or a one. Hunters who successfully did this were told that they were wrong: looking at all the letters corresponding to 1’s, as if they were light bulbs that’d been turned on, gave the phrase NOTQUITE. This is shown below; wires carrying 0s are black, and wires carrying 1s are white.

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.imgurl}}/maelstromsol2.png" width="100%" />
</p>

The real trick was to also realize that the pairs of crossed oars are XORs, which are different from ORs in that they output 0 if both their inputs are 1s. After noticing this, Hunters worked through the circuit again, getting an output phrase in the same way. If they did this correctly, they still got NOTQUITE, in almost the same way.

The real real trick was to also *also* realize that some of the knots are fake. Five of the knots are actually unknots - they’d come undone if you pulled on them. All the other knots are overhand knots.

Those who ignored the decoy knots but didn’t use XORs also got NOTQUITE. It was only when Hunters worked through the circuit with both tricks in mind that they wound up with ETHER, the answer to Maelstrom. The final circuit, with fake knots circled, is below.

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.imgurl}}/maelstromsol3.png" width="100%" />
</p>