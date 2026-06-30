---
layout: post
title: "Explainability as a form of system closure"
date: 2026-06-29 07:00:00
category: dl-science
emoji: 🦋
---

There's a question that's ringing out all over the machine learning world these days: *what the hell counts as an "explanation" of a complex system?* If you listen for a while to conversations in the labs of practitioners, the forums of mechanistic interpretability, the ivory halls of theory, or even the labs of AI-savvy neuroscientists or biologists, you'll start hearing this question thrumming behind lots and lots of more tactical conversations. Everybody wants to explain something about AI — what it's doing, why it's doing it, or how to make it do something different, depending on the person — and, invariably, everyone's struggling to do it. It's enough to make someone who's been at it for a few years start to seriously question the premise.

I guess this difficulty isn't all that surprising. After all, the whole conceit of neural networks was that they're a learning system that doesn't *need* human understanding of the problem structure as an input. I suppose this all really speaks to some deep human desire — some need — to understand: it was hard for us to accept that creating AI didn't require our understanding, and now we want to go understand everything in post-production. I wonder if it's futile.

I think that more scientists should at least consider the possibility. It's a gloomy thought, but sometimes you need to look directly at the void. Otherwise you might walk into it.

Does there *have* to be an explanation for the behavior of a complex system? This is as good a first question as any. There's usually a tacit belief in these communities that, yeah, of course, there ought to be. Let's play this from the other side: is there a counterexample of a system that admits no human-understandable explanation?

## A dynamical systems view

A nice setting to ask these questions is that of a dynamical system. Let's suppose you have a state variable $\mathbf{x} \in \mathbb{R}^d$ evolving according to some map $\mathbf{x}\_t = f(\mathbf{x}\_{t-1})$. Let's say the dynamics are deterministic to steelman our intended position. This is general enough to include every deterministic system, including the forward pass of a neural net.[^1]

Suppose that we begin at a state $\mathbf{x}\_0$ and later end up at a state $\mathbf{x}\_T$. Suppose we seek a human-interpretable "explanation" of "why" the system wound up at position $\mathbf{x}\_T$ instead of some other position. Judging by what people seem to want in applied settings, a satisfying "explanation" would need to achieve the following:

- allow a human to "intuitively grasp" the path followed from $\mathbf{x}\_0, \mathbf{x}\_1, \ldots, \mathbf{x}\_T$, such that the human can ascertain why the final state was roughly $\mathbf{x}\_T$ without computational assistance; and
- this explanation should be sufficiently complete and actionable to allow a human-interpretable recipe for intervention, again without computational assistance: for example, which direction we should give a (microscopic) perturbation to $\mathbf{x}\_0$ in order to push $\mathbf{x}\_T$ in a desired direction?

Forbidding computational assistance to our human here might seem strict, but this is truly the standard most of the groups named above seek (whether or not they're explicit about this). You can use computational aids as much as you want to *find* the explanation, but ultimately the explanation has to live entirely *in neuro* — that is, in the mind of the scientist. When asked what they're looking for, these folks (myself included) often say "I'll know it when I see it," which really means they want to be able to model the whole system in the mind, the way every major scientific theory works, and the way a mechanic operates on a car.

So: let's return to the question at hand. Does there exist a satisfying "human-interpretable" explanation for any dynamical system?

An instructive case to consider is one in which the dynamics are *chaotic:* for example, if our system is the [logistic map](https://en.wikipedia.org/wiki/Logistic_map) or a double pendulum. In a chaotic system, a tiny perturbation to the "input" $\mathbf{x}\_0$ will totally change the output $\mathbf{x}\_T$, and there's no hope of giving either:

- a human-interpretable account of "why" we got roughly $\mathbf{x}\_T$ specifically, or
- a human-interpretable recipe for intervention, i.e. which direction we should give a (microscopic) perturbation to $\mathbf{x}\_0$ in order to push $\mathbf{x}\_T$ in a desired direction.

As the chaotic dynamics proceed, it will become steadily harder for a human to hold any representation of the forward map $\mathbf{x}\_0 \mapsto \mathbf{x}\_T$ in their mind, and *in neuro* answers to the above will become impossible. Here's an illustration of this principle using the [Lorenz attractor](https://en.wikipedia.org/wiki/Lorenz_system), a chaotic set of differential equations in three dimensions:

<div id="lorenz-figure" style="margin: 2em 0;">
  <div id="panel-A" style="position:relative; background:#fff; border:1px solid #ccc; border-radius:4px; overflow:hidden; height:740px;">
    <canvas id="lorenz-canvas-A" style="width:100%;height:calc(100% - 56px);display:block;cursor:grab;"></canvas>
    <div id="lorenz-t-label">$t = $ <span id="lorenz-t-value" style="font-family:'MathJax_Main','Latin Modern Math',Georgia,serif;">0</span></div>
    <div id="lorenz-wp-text"></div>
    <div id="lorenz-eqns">
      $\dot{x} = \sigma(y - x)$<br>
      $\dot{y} = x(\rho - z) - y$<br>
      $\dot{z} = xy - \beta z$<br><br>
      $\sigma = 10$<br>
      $\rho = 28$<br>
      $\beta = \tfrac{8}{3}$
    </div>
    <div id="lorenz-controls-A">
      <div id="lorenz-slider-row">
        <span id="lorenz-axis-label" style="margin-top:-13px;">timestep <i>t</i></span>
        <div id="lorenz-slider-wrap">
          <input type="range" id="lorenz-slider-A" min="0" max="1000" step="1" value="0">
          <canvas id="lorenz-tick-canvas" height="16"></canvas>
          <canvas id="lorenz-marker-canvas" style="position:absolute;top:0;left:0;width:100%;pointer-events:none;z-index:0;"></canvas>
        </div>
        <div id="lorenz-btns-A">
          <button id="lorenz-btn-A" title="Play/pause"></button>
          <button id="lorenz-reset-A" title="Reset"><i class="fa-solid fa-rotate-left" style="position:relative;top:-3px;"></i></button>
        </div>
      </div>
    </div>
  </div>
</div>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

<style>
#lorenz-controls-A {
  position: absolute; bottom: 0; left: 0; right: 0; height: 56px;
  z-index: 4; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.9);
}
#lorenz-slider-row {
  display: flex; align-items: center; gap: 10px; width: 55%;
}
#lorenz-slider-wrap { flex: 1; display: flex; flex-direction: column; position: relative; }
#lorenz-slider-A { width: 100%; margin: 0; }
#lorenz-tick-canvas { width: 100%; display: block; pointer-events: none; }
#lorenz-axis-label { font-size: 11px; color: #888; white-space: nowrap; flex-shrink: 0; }
#lorenz-btns-A { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
#lorenz-btn-A, #lorenz-reset-A {
  background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; opacity: 0.6;
}
#lorenz-btn-A:hover, #lorenz-reset-A:hover { opacity: 1; }
#lorenz-eqns {
  position: absolute; top: 10px; left: 12px; z-index: 4;
  font-size: 16px; color: #555; line-height: 1.9;
  pointer-events: none;
}
#lorenz-wp-text {
  display: none;
  position: absolute; bottom: 72px; left: 50%; transform: translateX(-50%);
  width: 85%; z-index: 5; font-size: 14px; font-family: system-ui, sans-serif;
  text-align: left; pointer-events: none; font-weight: 400; line-height: 1.5;
  white-space: pre-line;
  background: rgba(255,255,255,0.88); border-radius: 6px; padding: 10px 14px;
  border: 1.5px solid currentColor;
}
#lorenz-t-label {
  position: absolute; top: 8px; right: 10px; z-index: 4;
  font-size: 20px; color: #666; font-family: system-ui, sans-serif;
  pointer-events: none;
}
</style>

<script type="module" src="{{site.baseurl}}/explainability-as-system-closure/viz.js"></script>

The key point is that the complexity of the forward map increases *extensively* with time $T$, so no matter how much effort the human is willing to put into constructing a mental model of the forward map, it'll become impossible after long enough (which might not actually be that long).[^3]

<div style="margin: 2em 0; text-align: center;">
  <img src="{{site.baseurl}}/img/explainability/complexity_figure.png" alt="complexity vs time figure" style="width: 54%;">
  <p style="margin-top: 0.5em; font-size: 0.85em; color: #555;"><em>A sufficiently complex forward map is not human-interpretable. In a chaotic system, the forward map steadily increases in complexity.</em></p>
</div>

**In summary, any chaotic system gives us a counterexample that proves that not every system even *admits* a human-interpretable "explanation."** This should give us pause in trying to "explain" deep neural nets: maybe it's impossible. The universe doesn't run on explanations, it runs on physics, and there's no guarantee that human-understandable explanations exist.

### What if we restrict to non-chaotic systems?

Chaotic systems are famously intractable, and so this might seem to offer a glimmer of hope. However, this hope is easily dashed. Consider instead the following system:

$$
\mathbf{x}_t = \begin{cases} 
      f(\mathbf{x}_{t-1}) & t \le T, \\
      g(\mathbf{x}_{t-1}) & t > T,
   \end{cases}
$$

where $f(\cdot)$ is a chaotic system and $g(\cdot)$ is non-chaotic and as simple as you like. With any finite crossover time $T$, the dynamics aren't technically chaotic, since chaos is asymptotic. As $T$ grows, however, the forward map gets more and more complicated, and we can invoke our previous argument just fine. The root of the problem in the chaotic case wasn't the chaos, it was just that the forward map is really complicated. Eventually it gets so complicated that a human can't approximate it all *in neuro.*

## The nature of explanations

The real fruit to pluck from this chaos counterexample is an intuition about what we mean by an "explanation." The crazy thing about chaos is that there's a sort of "upward causal flow" from microvariables to macrovariables: the precise position within a small volume of state space eventually flows upwards to greatly affect the coarse position across a large volume. (Or, if you prefer CS language: the less-significant bits in a binary representation of $\mathbf{x}\_t$ eventually affect the most-significant bits.)

This means that the system isn't *closed* in a finite number of variables. In a non-chaotic system, if you want to predict the leading $k$ bits of $\mathbf{x}\_T$, you can do that from $O(k)$ leading bits of $\mathbf{x}\_0$, regardless of $T$. In a chaotic system, you generally need $O(k \cdot T)$. This means that the leading $k$ bits don't form a closed system, even approximately.

The big idea here is that an explanation is precisely a *closed mental model* of a system, or at least part of it. Since you want to hold the entire thing in your head, it's got to take human-interpretable inputs and predict human-interpretable outputs, and thereby comprise an (approximately) closed system on human-interpretable variables. Here are some examples:

- A mechanic working on a car has thousands of "car variables" in mind: different components, their shapes and materials, their ages and wear, their temperatures and affordances and interactions and potential problems. The more experienced the mechanic, the more variables they can track, but it's always finite. (For example, I doubt any mechanic has a mental model with more than a million components. Don't ask me how to count.) They can then mentally model a car as a closed system in these variables, and thereby make inferences based on observations as to what's going on inside this system.
- A scientific theory gives a closed mental model within human-understandable variables. For example, Newton's laws describe the movements of objects as a closed system. Mendelian genetics describes a closed system within genes and phenotypes. It's often said that a scientific theory has to be *predictive,* and this is just another side of the coin of being closed in the dynamical systems sense.
- When you start to feel you "understand" a person, this is usually because you start to get a mental model of how different things around them affect their internal experience, and how that leads to different output. This is precisely an approximate model of some parts of that person as a closed system.

Of course, except in the very cleanest cases, these systems aren't strictly closed. Newtonian mechanics isn't closed (c.f. quantum mech and relativity), genetics (and any biological theory) is full of complexities and caveats, and heaven knows you can't understand any part of a person as a closed system. Even the most skilled mechanic is going to be guessing a lot of the time. But *approximately,* with a much *greater-than-chance fidelity,* you can understand these things as leaky closed systems in human-interpretable variables.

Another important note is that these variables need not be obvious a priori. "Most of the work" in coming up with most scientific theories is in identifying the right variables. The requirement is that they're human-understandable a posteriori.

In a dynamical system, the human-interpretable variables are things like "the system was in this rough region of state-space" or "the third bit of a binary representation of the state variable was a $0$" or "the system moved between regions $A$ and $B$ three times in the last $n$ steps." Our chaotic system is inherently unexplainable because it's (provably, mathematically) *not closed* in any finite set of variables.[^2]

## So can we "explain" deep learning?

None of this means that science of a complex system like deep learning is impossible. It just means that a science of a complex *enough* system is impossible. We should attack the problem from both sides, identifying the simple parts we *can* understand.

What we should be looking for is precisely *approximate closures in human-understandable variables.* The challenge of the scientist looking at a complicated system is precisely to identify a set of human-graspable variables and their interactions. We should remain humble in that regard and be clear that we seek avenues towards finding those variables and describing the system they comprise.

For example, at its best, mechanistic interpretability finds human-understandable interactions between intuitive variables in model input, weights, internal states, and outputs. (Think: "input text of one of a few types goes in; model weights and internals comprise certain circuits; model output is predictable by a human given an understanding of these circuits.") At its worst (and perhaps its median), mechinterp is confused as to what variables it describes, how they interact in a closed system, and what the path to a full understanding is.

At its best, fundamental deep learning science finds closed interrelationships between intuitive mathematical quantities, usually system hyperparameters or macroscopic statistics. (Think: "[Hessian sharpness steadily increases to $2 / \eta$ before it is stabilized there by the third-order curvature of the loss landscape](https://centralflows.github.io/)" or "[to preserve key macroscopic stats, layerwise learning rates should scale a particular way with layer widths.](https://arxiv.org/abs/2310.17813)") At its worst (and, yes, perhaps its median), it is confused about its variables of study, their potential interrelationships, and its goals. We tried to lay out a vision of the best fundamental science of deep learning in our recent perspective paper, ["There Will Be a Scientific Theory of Deep Learning,"](https://tinyurl.com/learning-mech) and a huge through-line in that paper is the identification of important macroscopic stats and the description of their interrelationships.

The reality is that, when facing a complex system, it's probably going to be the case that some part of it *is* human-understandable, and some part of it is going to be too complex. (This is all but inevitable, since system complexity is in principle unbounded, but a human's capacity to hold a detailed mental model *in neuro* is finite.) Of course, the more effort the human's willing to put into developing their understanding, the more variables they might hold in their head, and the more of the system might become understandable, provided those variables dynamically close. Some systems are easier to understand than others, and many (most?) complex systems admit both an easy shallow understanding and more challenging deeper understandings.

We should just be very clear-eyed going in that we're not trying to understand everything, it's possible that we *can't* construct an *in neuro* explanation for some things, and that we'd better be clear what we're going for, lest we waste a lot of time trying to do the impossible. Seems to me that where a lot of time gets wasted is when people see a human-interpretable *output* (for example, "this self-driving car ran a red light") and expect that this must admit a human-interpretable explanation. Well, the example of the Lorenz attractor proves by example that the universe doesn't owe you any such explanation: even though "output" observations like "$\mathbf{x}\_T$ falls in the left lobe of the butterfly attractor" *are* human-interpretable, they're causally downstream of a huge number of variables that aren't, and thus aren't part of a closed system of a finite number of human-interpretable variables, and thus don't admit predictive explanations of the sort we want in most scientific applications.

---

*This essay was inspired by a visit to [CHAI](https://humancompatible.ai/) at which [Ram Rachum](https://docs.rachum.com/) presented work on explanations for RL systems. The idea of system closure came out of a conversation with [Julian Yocum](https://scholar.google.com/citations?user=LKfjNEkAAAAJ&hl=en), who (if I recall correctly) offered it in rebuttal when I invoked chaos to argue that there need not exist satisfying explanations.*

[^1]: And the full training process, given the relevant random seeds.

[^3]: Don't get me wrong, there's a lot we can understand about the Lorenz system: the shape of the attractor, the fact that it *is* chaotic, the Lyapunov exponents, and more. I don't mean to say that we simply cannot "understand" the Lorenz system in any way. But the nature of the chaotic system means that we really can't "understand" any of the dynamical variables in the human-interpretable, mental-model, fully-*in-neuro* way that many communities hope to understand deep learning. (Note that since every trajectory ends up near the attractor, being on the attractor isn't a dynamical variable, it's a constant.) We only feel we understand chaotic systems like these because we know that certain types of understanding or prediction are impossible, so we know not to try. The question this should make you ask about the complex system you're studying in your research is: which types of human-interpretable explanation are actually going to be possible?

[^2]: You might feel you "understand" the Lorenz attractor in the graphic above. For example, you might point out that after a sufficiently long time, the system will be found near the famous butterfly-shaped strange attractor, and that mathematical properties of that attractor may be characterized. This is fair. For the purposes of this essay, however, this really just means that some leading-order bits of the system are *fixed* — at large $T$, they're no longer even dynamical variables — and all the true dynamical variables don't form a closed system. We only feel we understand the dynamics because we can satisfy ourselves that we could *never* predict the real dynamical variables. Let's not kid ourselves.
