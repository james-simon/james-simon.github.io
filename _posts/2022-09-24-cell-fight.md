---
layout: post
title: "Simulating cells fighting to the death"
date: 2022-09-24
category: physics, fun-science
---


Physics is humanity's finest tool for understanding the world around us, a rich and wonderful framework deserving of our highest reverence.
I recently used it to simulate a bunch of cells fighting to the death like little gladiators.
Here's a video.

<video autoplay loop muted playsinline width="40%" style="display:block; margin: 0 auto;">
    <source src="{{site.baseurl}}/img/cell_fight/cell_fight.mp4" type="video/mp4">
</video>

I'll give a lightning overview of how this works.
This is a simulation lying on a grid, with every color either empty or part of a cell.
The grid's evolving in time according to a modified version of the [cellular Potts model](https://en.wikipedia.org/wiki/Cellular_Potts_model), which is basically the [Ising model](https://en.wikipedia.org/wiki/Ising_model) plus a few terms.
In the Ising model, each cell prefers to match its neighbors, so the grid forms big regions of the same color.
Here's the Ising model:

<video autoplay loop muted playsinline width="40%" style="display:block; margin: 0 auto;">
    <source src="{{site.baseurl}}/img/cell_fight/ising_test.mp4" type="video/mp4">
</video>

Skipping a mathematical explanation, the basic algorithm at play here is the following: at every timestep, (a) choose a random grid site and (b) flip its value with some probability.
The probability of flipping is higher if flipping will make it more like its neighbors, and this is coded in terms of an "energy" which is lower the more sites match their neighbors.

The Potts model is a generalization to more than two values.
In the *cellular* Potts model, we simply add another term to the energy.
For each value $$i$$ besides the "empty value" $$0$$, we count up the number of sites of type $$i$$ and penalize the difference from a target volume $$V_i$$.
This enforces that the sites with value $$i$$ have total volume around $$V_i$$, and the Ising term from before makes it so these sites tend to stick together, forming a round droplet like water molecules.
Here's the cellular Potts model with a few randomly-placed cells:

<video autoplay loop muted playsinline width="40%" style="display:block; margin: 0 auto;">
    <source src="{{site.baseurl}}/img/cell_fight/cells_stationary.mp4" type="video/mp4">
</video>

To make them fight, I just added a third energy term which makes a site more likely to flip to the color of cell $$i$$ if doing so would move the center of mass of cell $$i$$ towards its nearest neighbor, and then added the ad hoc rule that, when one cell loses a site to another cell, its target volume $$V_i$$ decreases to track its loss of hitpoints.

Superficially, this is just a cute simulation of some artificial cells, but, for me, it gets at one of the deep wonders of life.
These cells exhibit high-level "purposeful" behavior, but their motion is entirelly driven by extremely simple low-level rules (and they're not even deterministic!).
Just like in a real organism - just like in *us*, science believes - this purposeful behavior emerges from the interaction of many pseudorandom low-level components.
These cells were not programmed via top-down rules, as one might code a video game enemy (walk towards player, move limbs while doing so, fire when X feet away, etc.); their high-level behavior emerges fully from the bottom up.

In a typical video game, the *player's* character, too, is controlled via top-down instructions, in this case from a live human.
Could one design a game in which the player's influence is exerted from the bottom up, as a slight modification to the low-level rules instead of a top-level directive?
This is indeed doable with this simulator: I just replaced one cell's stochastic bias towards its nearest neighbor with a bias towards the direction of keyboard input.
Here's a fight between my brother and I.

<video autoplay loop muted playsinline width="40%" style="display:block; margin: 0 auto;">
    <source src="{{site.baseurl}}/img/cell_fight/cell_duel.mp4" type="video/mp4">
</video>

Okay, I also added bullets.

You can find code for these simulations [here](https://github.com/james-simon/cell-fight).

<!-- These two possible methods of exerting outside influence on a simulation are intriguingly similar to certain human conceptions of divine intervention in the universe.
The older notion is that a deity would directly change the world as desired (e.g., if they don't want a tree to exist, just smite it).
A newer notion is that a deity might act by minimal intervention, subtly changing low-level parameters of the universe (e.g. if they don't want a tree to exist, slightly deplete the CO2 in the vicinity during its growth, or spike a few neurons in a squirrel brain to make it find and eat the tree as a seed, or so on). -->