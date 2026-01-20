---
layout: solpage
type: solution
title: 90 Shades of Black
flavortext: Agent Shade, who made this one, is a friend of mine; she seems a dark character at first impression, but that changes as you get to know her.
origin: VT Hunt 2022
answer: hue
published: false
---

Though the grid looks pure white and black at first glance, the squares are actually a polychromatic collage of different dark shades, and some of the lines are grey. Except for a few true-black squares, each dark square had red, green, and blue values between 1 and 26, and their color could be read as a three-letter string. Most of these denoted colors, like BLK, WHT, RED, GRN, or BLU. Recoloring squares accordingly, we get the following grid:

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.baseurl}}/img/90shades/90shades_sol1.png" width="50%" />
</p>

The top row reads RGB SEMAPHORE. Noting that yellow is red + green, cyan is green + blue, magenta is blue + red, and white is red + green + blue, each 3x3 subgrid could be decomposed into a superposition of three red, three green, and three blue squares, and each color could be independently read as a semaphore letter. Here’s the upper-left subgrid as an example:

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.baseurl}}/img/90shades/90shades_sol2.png" width="80%" />
</p>

Each subgrid gave a color just like each square, suggesting we should view the subgrids as squares in a grand 3x3 metagrid. Translating every subgrid (and discarding the instruction row) gave this metagrid:

<p align="center">
  <img style="float: center; margin: 0px 15px 15px 0px;" src="{{site.baseurl}}/img/90shades/90shades_sol3.png" width="20%" />
</p>

Decoding the semaphore like before, this gives HUE, the final answer.