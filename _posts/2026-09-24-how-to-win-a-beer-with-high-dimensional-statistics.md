---
layout: post
title: "How to win a beer with high-dimensional statistics"
date: 2026-09-24 07:00:00
category: dl-science
emoji: 🍺
---

My longtime labmate-turned-student/friend[^1] Dhruva Karkada recently wrote [a sick paper on data statistics](https://arxiv.org/abs/2602.15029) which deservedly went viral on Twitter, in part because it has one of the prettiest scientific figures I have ever seen:

<div style="text-align: center; margin: 2em 0;">
  <img src="{{site.baseurl}}/img/circulant_words/months_circle.png" alt="Calendar month embeddings forming a circle in PCA space, with circulant Gram matrices" style="width: 50%;">
</div>

Say you've got a bunch of words that live in a vocabulary $\mathcal{V}$. We're here studying models $f$ that map $f: \mathcal{V} \rightarrow \mathbb{R}^d$: that is, they map every word to a $d$-dimensional vector. We're letting $\\{v\_i\\}\_{i=1}^{12} = \\{\texttt{January}, \texttt{February}, \ldots\\}$ be the months of the year, taking the 12 associated embedding vectors $\mathbf{w}\_i = f(v\_i)$, and computing two things:

- a projection onto the top two PCA directions of $\\{ \mathbf{w}\_i \\}$ (left column), and
- the Gram matrix $\mathbf{M} \in \mathbb{R}^{12 \times 12}$ such that $M\_{ij} = \mathbf{w}\_i^\top \mathbf{w}\_j$ (right column).

Reading the rows of this figure from top to bottom,[^2] they find that:

1. LLM embeddings project down to a circle (as [Engels et al (2024)](https://arxiv.org/abs/2405.14860) also saw), and the Gram matrix is approximately a circulant matrix;
2. these findings are decently approximated even with primitive `word2vec` embeddings; and
3. an analytical theory of the circulant Gram matrix gives a very compelling-looking match.

This is a big deal because it connects data statistics to representational geometry with a really simple mathematical theory.

### Finding a needle

After seeing this a bunch of times and staring at it for a while, I was feeling in the mood to poke a hole in this beautiful result, and so I bet Dhruva a beer that I could find a collection of *other, seemingly-unrelated words* that form a circle + circulant matrix in the same way. He (and most others I told) thought this was crazy, since the circle clearly comes from the special relationship between the words. We settled on the terms of the bet: I had to find ten random-seeming words whose `word2vec` embeddings, when plotted as the above, made a clear and compelling circle.

Why'd I think this was possible? Well, we have vocabulary of $25000$ words to choose from. That gives you $N = \binom{25000}{10} \approx 3 \times 10^{37}$ sets to select from. I figured that if you threw ten darts at a board that many times, you'd definitely make a circle at least once. Info-theoretically speaking, you have $\log\_2 N \approx 124$ bits of information, and surely you can make a decent 10-point circle with that amount of resolving power. The question's just how you find a set of ten good words in the haystack.

Here's how I did it:

- From looking at PCA plots of random sets, I guess you'd get a decent circle from a random selection with probability maybe $3^{-10}$, so random guessing could plausibly work.
- I wrote a "looks circular" objective function, drew tens of thousands of random sets, and chose the best one. It was borderline, but not good enough to utterly obliterate Dhruva.
- I upgraded it to an iterative search, where at every step, we drop the worst point and choose the best replacement from the vocabulary. That worked pretty well.
- I also changed the objective from "looks circular on a PCA plot" to "matches a target circulant Gram matrix." That worked really damn well.

This all took an afternoon with a coding agent.

Here's what I got:

<div style="text-align: center; margin: 2em 0;">
  <img src="{{site.baseurl}}/img/circulant_words/spurious_circle.png" alt="Ten seemingly-unrelated words forming a circle in PCA space, with a circulant Gram matrix" style="width: 95%;">
</div>

That's circular. You can just find other sets of random-looking words that form circles!

### Is there any actual significance of this?

This raises certain open questions, including "how can one man be so wrong?", which I am not qualified to answer.

But seriously: clearly we can find spurious geometric patterns. Should this change our understanding of representation geometry? I'd note a few caveats first:

1. While the Gram matrix of my spurious-circle-set is indeed beautifully circulant, the amplitude of the (sinusoidal) off-diagonals is less than with the months. I couldn't get em up to match the months' Gram matrix, even to within a factor of two.
2. This works damn well with a set of ten, but I doubt it'd work with a set of, say, 50 (though admittedly I didn't try very hard), so Dhruva's other geometric findings (about e.g. all the years from 1700-2020) couldn't be spoofed in this way.

Nonetheless, it does show that doing a kind of pursuit-matching-style search for a certain low-dim PCA'd geometry will trick you unless you've got enough statistical constraints on your target that it won't happen by random chance! This does rule out certain automatic-feature-finding algorithms, which has implications for research agendas like scalable interpretability.

***

[^1]: If this description seems wordy, it's because my job is confusing.

[^2]: Note: I've reversed the order of the rows for storytelling ease, not that it matters.
