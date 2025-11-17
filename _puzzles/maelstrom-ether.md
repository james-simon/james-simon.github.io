---
layout: solpage
type: solution
title: Maelstrom
flavortext: This whirlpool's just claimed a hapless ship. All that's left are a few bits and pieces tangled in the rigging, making circuits 'round the center.
origin: VT Hunt 2021
answer: ether
---

The rings on the right are each marked with eight stripes which, with white as 1 and black as 0, all match an ASCII letter: clockwise, they read “MNESOTAQHUINITEDER.” The rings on the left are thus each marked with a single binary bit.

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.baseurl}}/img/maelstrom/maelstromsol1.png" width="50%" />
</p>

Some repeated motifs stand out in the tangle of ropes in the center. There are small knots throughout. The oars are sometimes single and sometimes crossed in a pair, and in either case, they’re attached to ropes in the same way. No rope ends on anything but an oar or a life ring.

The trick is to realize that the entire puzzle is a logic circuit, as the flavortext hints. Knots correspond to NOT gates, oars are ORs, and the network of ropes are the wires. As is typical, the input bits are on the left, and the logical operations propagate the input rightwards to the output wires. The two inputs to a two-bit gate are on the same side of the oar, as in the standard symbols for two-bit logic gates.

With this insight, you can work through the circuit, propagating bits gate by gate through the circuit until each lettered life ring is given either a zero or a one. Upon doing this and taking the letters corresponding to 1s, you get the phrase NOTQUITE, a sign they're close but not quite right. This is shown below, with wires carrying 0s and 1s colored black and white respectively.

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.baseurl}}/img/maelstrom/maelstromsol2.png" width="50%" />
</p>

The real trick is to also realize that the pairs of crossed oars are XORs, which are different from ORs in that they output 0 if both their inputs are 1s. Reworking through the circuit with this change, however, you'll surprisingly still get NOTQUITE.

The real real trick was to also *also* realize that some of the knots are fake. Five of the knots are actually unknots (they’d come undone if you pulled on them). All the others are overhand knots.

If you correctly ignore the decoy knots but fail to substitute in the XORs, you'll *again* got NOTQUITE. It's only upon working through the circuit with both tricks in mind that you get ETHER, the answer. The final circuit, with fake knots circled, is below.

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.baseurl}}/img/maelstrom/maelstromsol3.png" width="50%" />
</p>