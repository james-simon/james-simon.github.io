---
layout: post
title: "Gravitree update: June 2024"
date: 2024-06-23 02:00
category: random
---

*This is an update to my [previous post](https://james-simon.github.io/blog/gravitrees/) introducing gravitrees.*

For almost ten years, I’ve been making kinetic balancing sculptures I now call *gravitrees.* They’re all designed around the same basic principle — pieces balance in an ascending stack with (usually) only one point of contact between each piece and the one below it — but there are many geometric ways to realize this principle, some of which are quite striking.

This post is a gallery of new designs I’ve come up with in the past year or so. I’ll conclude with some reflections and current outlook.

## *Poplar*

This design’s a classic, but it’s been perfected in the last year. I’ve made both regular-sized and mini versions.


<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<p style="text-align:center;">
				<img src="{{site.baseurl}}/img/gravitree_update/gravitree_classics.jpeg" style="width: 100%">
			</p>
        </div>
        <div class="col-4"></div>
    </div>
</div>

<br>

## *Manzanita*

This is now my go-to asymmetric design. The mini version’s quite cute!

<div class="container">
    <div class="row">
        <div class="col-2"></div>
        <div class="col-4">
        	<div style="width: 100%; height: 0; padding-bottom: 130%; overflow: hidden; position: relative;">
				<img src="{{site.baseurl}}/img/gravitree_update/manzanitas.jpeg" style="position: absolute; top: 0%; left: 0%; width: 100%; height: 100%; object-fit: cover;">
			</div>
			<!-- <img src="{{site.baseurl}}/img/gravitree_update/autogravitree_1.jpg" width="100%"> -->
        </div>
        <div class="col-4">
			<video autoplay loop muted playsinline width="100%" style="display:block; margin: 0 auto;">
			    <source src="{{site.baseurl}}/img/gravitree_update/manzanita_mini_blue.mp4" type="video/mp4">
			</video>
        </div>
        <div class="col-2"></div>	
    </div>
</div>

<br>

## *Pocket gravitree*

These miniature three-part gravitrees pack flat into a frame with the footprint of a credit card.
I carry one in my wallet.

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<video autoplay loop muted playsinline width="100%" style="display:block; margin: 0 auto;">
			    <source src="{{site.baseurl}}/img/gravitree_update/pocket_gravitree.mp4" type="video/mp4">
			</video>
        </div>
        <div class="col-4"></div>
    </div>
</div>

<br>

## *Tyrannosaur*

This was my first attempt to make one that extends sideways instead of up.
Most gravitrees feel like plants to most people, but this one’s more animal.
Especially when it's on its stand, it had an overbalanced look reminiscent of a T-Rex.

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<video autoplay loop muted playsinline width="100%" style="display:block; margin: 0 auto;">
			    <source src="{{site.baseurl}}/img/gravitree_update/tyrannosaur.mp4" type="video/mp4">
			</video>
        </div>
        <div class="col-4"></div>
    </div>
</div>

<br>

I also made a version that climbs upwards slightly. Not sure what its name is yet. It fills space very satisfyingly.

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<video autoplay loop muted playsinline width="100%" style="display:block; margin: 0 auto;">
			    <source src="{{site.baseurl}}/img/gravitree_update/stegosaur.mp4" type="video/mp4">
			</video>
        </div>
        <div class="col-4"></div>
    </div>
</div>

<br>

## *Chordata*

It’s fun to try to make one with as many pieces as possible. This one held the record at 13…

<!-- [^a] If you count carefully, you'll only find 12 in this picture. I need to reprint the last piece! -->

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<p style="text-align:center;">
				<img src="{{site.baseurl}}/img/gravitree_update/chordatus.jpeg" style="width: 100%">
			</p>
        </div>
        <div class="col-4"></div>
    </div>
</div>

<br>

## *Autogravitree*

…until this one, which has 20 pieces and was generated programmatically!

<div class="container">
    <div class="row">
        <div class="col-2"></div>
        <div class="col-4">
        	<div style="width: 100%; height: 0; padding-bottom: 130%; overflow: hidden; position: relative;">
				<img src="{{site.baseurl}}/img/gravitree_update/autogravitree_1.jpg" style="position: absolute; top: 0%; left: 0%; width: 100%; height: 100%; object-fit: cover;">
			</div>
			<!-- <img src="{{site.baseurl}}/img/gravitree_update/autogravitree_1.jpg" width="100%"> -->
        </div>
        <div class="col-4">
        	<div style="width: 100%; height: 0; padding-bottom: 130%; overflow: hidden; position: relative;">
	        	<div style="width: 100%; height: 0; padding-bottom: 130%; overflow: hidden; position: relative;">
					<img src="{{site.baseurl}}/img/gravitree_update/autogravitree_2.jpg" style="position: absolute; top: 0%; left: 0%; width: 100%; height: 100%; object-fit: cover;">
				</div>
			</div>
        </div>
        <div class="col-2"></div>
    </div>
</div>

<br>
<h4 class="toggle-header" onclick="toggleContent()">Click for technical details</h4>
<div class="toggle-content">
<p>When designing a gravitree, a lot of the CAD time’s spent manually tweaking different part dimensions so everything balances. It’s a pretty mechanical process, though, so I’d wanted to do it automatically for a while.

To get there, I scripted a single piece with variable dimensions in <a href="https://cadquery.readthedocs.io/en/latest/index.html">CadQuery</a>, then ran a Python script to generate a 20-piece gravitree with each piece made from that same template.</p>
</div>
<script>
    function toggleContent() {
        var content = document.querySelector('.toggle-content');
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    }
</script>
<style>
    .toggle-header {
        cursor: pointer;
        background-color: #f1f1f1;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
    }
    .toggle-content {
        display: none;
        margin-top: 10px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        background-color: #f9f9f9;
    }
</style>

<br>

## *Monstera*

With a five-foot span, it’s the biggest gravitree I’ve ever made. It’s lasercut wood that I woodstained.

<div class="container">
    <div class="row">
        <div class="col-3"></div>
        <div class="col-6">
			<p style="text-align:center;">
				<img src="{{site.baseurl}}/img/gravitree_update/monstera_2.png" style="width: 100%">
			</p>
        </div>
        <div class="col-3"></div>
    </div>
</div>

<br>

## *Gravitree 2.0* or *Triangulum*

This one might be the best I’ve ever made.

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<p style="text-align:center;">
			<div style="width: 100%; height: 0; padding-bottom: 110%; overflow: hidden; position: relative;">
				<img src="{{site.baseurl}}/img/gravitree_update/gravitree_two.jpg" style="position: absolute; top: -10%; left: -16%; width: 130%; height: 130%; object-fit: cover;">
			</div>
			</p>
        </div>
        <div class="col-4"></div>
    </div>
</div>


<br>

## The pagoda gravitree

I visited Japan last December and loved the architecture. This gravitree is inspired by [pagodas](https://web-japan.org/nipponia/nipponia33/images/topic/22_1.jpg) and [torii gates](https://savvytokyo.scdn3.secure.raxcdn.com/app/uploads/2019/08/Meiji-Jingu-Torii-Top-9-Shrines-to-Visit-in-Tokyo.jpg). This one was technically challenging: the pieces are so similar in size that, in order to get it all to balance, I needed to make the pieces very light but hide heavy weights inside. The structure here is balsa wood (the lightest wood), but inside hold tungsten (close to the heaviest material found on Earth). The upturned flare at the end of each member both gives space to hide the tungsten shot and mimic similar convex flares I liked in the Japanese architecture.

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<p style="text-align:center;">
			<div style="width: 100%; height: 0; padding-bottom: 100%; overflow: hidden; position: relative;">
				<img src="{{site.baseurl}}/img/gravitree_update/pagoda_gravitree.jpeg" style="width: 100%">
			</div>
			</p>
        </div>
        <div class="col-4"></div>
    </div>
</div>

<br>

## Gravitree earrings

These silver kinetic earrings make me seriously consider getting my ears pierced.

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<p style="text-align:center;">
			<div style="width: 100%; height: 0; padding-bottom: 100%; overflow: hidden; position: relative;">
				<img src="{{site.baseurl}}/img/gravitree_update/irian_earring.jpeg" style="position: absolute; top: 10%; left: 10%; width: 120%; height: 120%; object-fit: cover;">
			</div>
			</p>
        </div>
        <div class="col-4"></div>
    </div>
</div>


<br>

## Tao


This isn't technically a gravitree, but it's a near cousin.
The sculpture consists of a series of concentric circles, each locked into the next and free to spin within it.
The black half of each concentric circle is slightly thicker than the white half.
As a result of this weight imbalance, the sculpture tends to spin to form a yin-yang symbol: balance emerges randomly from chaos :)

<div class="container">
    <div class="row">
        <div class="col-4"></div>
        <div class="col-4">
			<video autoplay loop muted playsinline width="100%" style="display:block; margin: 0 auto;">
			    <source src="{{site.baseurl}}/img/gravitree_update/tao.mp4" type="video/mp4">
			</video>
        </div>
        <div class="col-4"></div>
    </div>
</div>

<br>

## Reflections


I'm pleased with the creativity of the designs I've come up with in the past two years.
With the earrings, pocket gravitree, and the wooden *Monstera,* I've pushed the boundaries of size and material, and with the *Triangulum* and *Autogravitree* I've pushed the previous boundaries of gravitree aesthetics and design methodology.
I'm most pleased with the designs that look different from the traditional weights-on-sticks appearance -- the *Triangulum* is undoubtably my most aesthetically appealing design yet -- and it seems exciting to explore how different I can make the structure look and still have it balance.

Another reflection here is that these ideas often take a long time to simmer in the background.
I regularly went many months without designing a gravitree, but I'd sometimes find that questions, hopes, designs, and problems were swimming around in the back of my head.
I'd occasionally have a moment of realization where I suddenly knew the answer to a problem I'd gotten stuck on some months prior and could thereby go quickly make a new design.
More often than that, though, I'd have moments of inspiration where I found myself with free time and suddenly excited to make some new designs.
This is, for me, a point broadly in favor of having side goals or interests that are usually dormant or inactive: they seem to cost comparatively little, but a small amount of time every so often, given only when inspired, can move them forward at a slow but steady pace.[^b]

[^b]: While I do feel my bang-per-unit-time for gravitrees has been fairly high, I do actually wonder whether the costs are greater than I'm making them out to be. I think about gravitrees a little every day, usually while idle or doing other things, and presumably I'd be thinking about something else for much of that span, which could add up to a lot.

I had a pretty high batting average with these models -- most of them ultimately worked, and many worked on the first try!
That said, a few of my more ambitious ideas did fail, including a gravitree that looked like a wedding cake where each layer was a pinwheel intended to spin in an opposite direction when placed in wind.
Despite the occasional failures, the exploratory ideas are the best part of this hobby.


<br>

## Prospects for selling gravitrees

People have been telling me for a few years now that I should sell gravitrees.
There's been a real uptick in this sort of comment lately, and with these new designs, I'm starting to believe it.
I'd love for gravitrees to be cheaply buyable (and it'd certainly be nice to make some profit off them).
A few obstacles here include that
- 3D printing is expensive. Shapeways has a marketplace I can sell through, but the prices are high -- about $30 for a small gravitree and $50 for a large one *without my making any profit!*
- I'm not sure how much people are willing to pay for these.
- Another manufacturing technique like injection molding would be cheaper, but then you're running a whole business, with inventory and everything. I'd be curious to know how that works, but I don't want to run something like that long-term.

A decent plan here seems to be to try to sell at a few local art fairs, gauge interest, and perhaps build an online presence.
If demand seems high enough, it could be worth looking for a business partner to handle productization.
(That seems to be what the artist behind the [Square Wave](https://kinetrika.com/) did.)
I'd also be happy to sell the idea to an existing company.
It seems worth getting a patent for gravitrees if they seem likely to be marketable.
Most broadly, if I move forward, seems worth reaching out to other people who have made businesses around comparable toylike products to find out how they did it.
If you have any suggestions or leads here, drop me a line!
