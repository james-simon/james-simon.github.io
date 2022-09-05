---
layout: post
title: "Time-reversed random walks"
date: 2022-09-03
category: math, fun-science
---

The [random walk](https://en.wikipedia.org/wiki/Random_walk) is a basic stochastic process in which a point explores a space by taking steps in random directions.
This process is used to model a swath of phenomena including the paths of diffusing particles, fluctuating stock prices, and the movements of foraging animals, and it's found use in essentially every discipline of science.
In the classic random walk, a particle starts at the origin at time zero and diffuses outwards.
In this post, we'll look at the statistics of this process when it's run backwards in time.

### The 1D discrete random walk

The simplest random walk is a 1D random walk with discrete steps.
Let $$x_0, x_1, x_2, ..., x_t, ...$$ be integers denoting the position of a random walker on a line at each timestep.
The initial condition and transition dynamics will be

$$x_0 = 0,$$

$$
\begin{equation}
\label{eqn:forward_step}
x_{t+1} =
\left\{
\begin{array}{lr}
x_t, & p = \frac{1}{2} \\
x_t + 1, & p = \frac{1}{2}.
\end{array}
\right.
\end{equation}
$$

In words, the random walker begins at zero and, at each timestep, flips a coin and either remains put or moves to $$x \rightarrow x + 1$$ accordingly.
(It's worth noting that we could've also chosen the possible steps to be not $$\{0,1\}$$ but rather $$\{-1,1\}$$ to ensure that the random walk has mean zero.
It will prove mathematically simpler to use our current formulation, however, but we can always recover the latter setting by constructing $$\tilde{x}_t \equiv 2 x_t - t$$.
We will use $$\tilde{x}_t$$ in our visualizations below, and we will refer to the two possible steps as "leftwards" and "rightwards.")


Suppose we want to know $$p(x_t)$$, the probability of the walker being at position $$x_t$$ at time $$t$$.
By placing this random walk on Pascal's triangle, it's easy to show that this distribution is given by

$$\begin{equation} \label{eqn:p_forwards}
p(x_t) = 2^{-t} \left( \begin{array}{c} t \\ x_t \end{array} \right).
\end{equation}$$

Figure 1 gives an schematic illustration of this random walk as well as a visualization of many simulated runs[^d].

<p align="center">
   <img src="../../img/reversed_rws/rev_rws_fig1a.png" width="30%">
   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
   <img src="../../img/reversed_rws/rev_rws_fig1b.svg" width="30%">
</p>
<p style="margin-left:20%; margin-right:20%;">
<small>
<i>
	<b>Figure 1.</b>
	Left: in the 1D discrete random walk, the walker moves left or right at each timestep with probability $1/2$.
	Right: simulated random walks.
	The upper plot shows a histogram of final positions (blue) and the theoretical distribution (red).
</i>
</small>
</p>

### Reversing time

The above random walks start at the origin at $$t=0$$ and take uncorrelated steps from then on.
This is easy to simulate, as every step is independent of every other step.
Let us now imagine how these trajectories look to an observer moving backwards in time[^c].
The walkers start in a wide distribution, take fairly random steps, but then magically converge at the origin at $$t=0$$.
Suppose you wish to find the statistics of this process from the point of view of this backwards observer: given that they observe a walker at position $$x_t$$ at time $$t$$, what are its transition probabilities for the step to time $$t - 1$$?
(Equivalently, we could forget about the time reversal and ask about the statistics of a path conditioned on its intersecting $$(t, x_t)$$, but that's less fun.)

We would like to obtain an update equation similar to Equation $$\ref{eqn:forward_step}$$ which gives us the statistics of $$x_{t-1}$$ as a function of $$x_t$$ (because the random walk is a Markov process, we need not consider $$x_{t+1}$$ and so on).
We can do so using [Bayes' rule](https://en.wikipedia.org/wiki/Bayes%27_theorem), which, applied to our case, tells us that

$$p \left( x_{t-1} | x_{t} \right) = \frac{ p \left( x_{t} | x_{t-1} \right) p \left( x_{t} \right) }{ p \left( x_{t-1}\right) }.$$

Equation $$\ref{eqn:forward_step}$$ gives $$p \left( x_{t} | x_{t-1} \right)$$ and Equation $$\ref{eqn:p_forwards}$$ tells us $$p(x_{t-1})$$ and $$p(x_t)$$.
Inserting the results and simplifying algebraically, we find that

$$
\begin{equation}
\label{eqn:backward_step}
x_{t-1} =
\left\{
\begin{array}{lr}
x_{t} - 1, & p = \frac{x_t}{t} \\
x_{t}, & p = \frac{t - x_t}{t}
\end{array}
\right.
\end{equation}
$$

Examining these transition probabilities, we see that, when run backwards in time, our random walk is biased towards taking a step right if $$x_t < \frac{t}{2}$$ and biased towards taking a step left if $$x_t > \frac{t}{2}$$, and that the probability of a step left interpolates linearly from $$0$$ to $$1$$ as $$x_t$$ increases from $$0$$ to $$t$$.
These centerwards biases ensure the walker remains in the "lightcone" leading into the origin.
When $$x_t \approx \frac{t}{2}$$, the step is roughly unbiased, and backward propagation is simply the same random walk as the forward propagation.
We generally expect $$x_t \approx \frac{t}{2}$$ at large $$t$$, and so the biasedness of the reverse process only comes into play at small $$t$$ or when $$x_t$$ drifts unusually close to the edges of $$[0,t]$$.
These position-dependent transition probabiliteis are illustrated schematically in the left subfigure of Figure 2.

The center and right subfigures of Figure 2 depict simulated reversed random walks starting at a particular point and run backwards to $$t=0$$ using Equation $$\ref{eqn:backward_step}$$.
The resulting trajectories look a lot like normal random walks for the first few steps, pick up a noticeable drift towards the origin as time proceeds, and quickly coalesce to the origin towards the end, in line with our expectation that the constraint of intersection with the origin is felt most strongly as $$t=0$$ draws near.
It's worth noting that we could have generated these trajectories by randomly sampling *forwards* walks and only keeping those which intersect our chosen starting point, but directly simulating the backwards process is way more efficient.

<p align="center">
   <img src="../../img/reversed_rws/rev_rws_fig2a.png" width="30%">
	&nbsp;&nbsp;&nbsp;
   <img src="../../img/reversed_rws/rev_rws_fig2b.svg" width="60%">
</p>
<p style="margin-left:20%; margin-right:20%;">
<small>
<i>
	<b>Figure 2.</b>
	Left: example transition probabilities at various points in a reversed random walk.
	Center: simulated reversed random walks starting at $t = 100, x_t = 10$.
	The red curve shows the mean position.
	Right: simulated reversed random walks starting at $t = 1000, x_t = 40$.
	The red curve shows the mean position.
</i>
</small>
</p>

### Jumps of many timesteps

In all our analysis so far, we've only tried to move forwards or backwards in time one step at a time.
However, if we're not interested in the intermediate trajectory, it's easy to jump forwards multiple steps at a time, and it turns out we can do this backwards, too.
Consider two times $$t, t'$$ with $$t' > t$$.
Noting that the section of the random walk from $$t$$ to $$t'$$ is itself a random walk of length $$t' - t$$, we find that

$$
\begin{equation}
\label{eqn:p_forwards_jump}
p\left(x_{t'} | x_t\right) = 2^{-(t' - t)} \left( \begin{array}{c} t' - t \\ x_{t'} - x_t \end{array} \right).
\end{equation}
$$

With the same Bayesian approach as before, we can derive transition probabilities for a backwards jump.
This yields that

$$
\begin{equation}
\label{eqn:p_backwards_jump}
p\left(x_{t} | x_{t'}\right) =
\frac{
	\left( \begin{array}{c} x_{t'} \\ x_{t} \end{array} \right)
	\left( \begin{array}{c} t' - x_{t'} \\ t - x_{t} \end{array} \right)
}{
	\left( \begin{array}{c} t' \\ t \end{array} \right)
},
\end{equation}
$$

which reduces to Equation $$\ref{eqn:backward_step}$$ when $$t' - t = 1$$.

### The continuum limit

While the discrete random walk is the easiest to grasp, in practice one often takes a *continuum limit* in which the walker's motion is continuous in both time and space.
This can be seen as the limit of a discrete-time random walk like the one studied above where, instead of taking $$\mathcal{O}(1)$$ jumps with timesteps of size $$1$$, our walker takes $$\mathcal{O}(dt^{1/2})$$ jumps with timesteps of size $$dt$$.

To get to the continuum, we'll first switch from a discrete random walk to one in which the steps are sampled from a Gaussian distribution.
This will make our walk continuous in *space*, which will simplify the subsequent process of making it continuous in time.
We shall redefine our random walk as

$$x_0 = 0,$$

$$
\begin{equation}
\label{eqn:forward_step_gaussian}
x_{t+dt} \sim \mathcal{N}(x_t, dt),
\end{equation}
$$

where $$dt$$ is a small constant step size and $$\mathcal{N}(\mu,\sigma^2)$$ is a Gaussian random variable with mean $$\mu$$ and variance $$\sigma^2$$.
Time-reversing this process with our same Bayesian trick, we find that

$$
x_{t}
\sim
\mathcal{N}\left(
\frac{
x_{t+dt}
}{
1 + \frac{dt}{t}
},
\frac{
dt
}{
1 + \frac{dt}{t}
}
\right)
\approx
\mathcal{N}\left(
\left(1 - \frac{dt}{t}\right) x_{t+dt}
,
dt
\right),
$$

where in the last step we've simplified assuming that $$dt \ll t$$.
Abusing notation a bit, we can write that

$$
x_{t}
\approx
\left(1 - \frac{dt}{t}\right) x_{t+dt}
+
\mathcal{N}\left(0,dt\right).
$$

We can now simply take $$dt \rightarrow 0$$ and arrive at a differential equation for the continuum limit, findin ghtat

$$
\begin{equation}
\label{eqn:sde}
\frac{d x(t)}{-dt} = - \frac{x(t)}{t} + \eta(t),
\end{equation}
$$

where $$\eta(t)$$ is the classic white noise process defined by having mean zero and covariance $$\mathbb{E}[\eta(t)\eta(t')] = \delta(t - t')$$.
We can now see that this equation has a simple interpretation: this is an ordinary random walk with a *drift* towards $$x = 0$$ with strength $$t^{-1}$$.
As the process runs backwards, the random walker is drawn towards the origin on average and is ultimately sucked in as $$t \rightarrow 0$$.

Neglecting the driving noise and looking at only the drift term, we see that the mean of our distribution $$\mu(t) \equiv \mathbb{E}[x(t)]$$ obeys

$$
\frac{d \mu(t)}{-dt} = - \frac{\mu(t)}{t} \ \ \ \Rightarrow \ \ \ \mu(t) = C t
$$

for some constant $$C$$.
This tells us that we expect that the mean of the distribution to approach zero linearly.
Looking at the red curves in Figure 2, we see this is exactly what happens!

### Chasing a moving target

Unlike the forward process, this reversed process isn't stationary (i.e. time-translation invariant): as it runs, it approaches $$t = 0$$, and its behavior changes.
Stationary processes are nice, though; is there simple a way we could modify it to make it $$t$$-independent?
One idea is to make it so the particle is chasing a moving target in a carrot-on-a-stick fashion: we fix some time $$T$$ and "move" $$t=0$$ so it is always time $$T$$ away from the present.
Like the advent of self-driving cars or quantum computing, the end of this process will always be a fixed time away.
Mathematically, this corresponds to replacing $$t \rightarrow T$$ in Equation $$\ref{eqn:sde}$$, yielding

$$
\frac{d x(t)}{-dt} = - \frac{x(t)}{T} + \eta(t).
$$

This process is stationary and has an even simpler interpretation.
In fact, it's exactly the classic [Orenstein-Uhlenbeck process](https://en.wikipedia.org/wiki/Ornstein%E2%80%93Uhlenbeck_process),
a mean-reverting process which a particle's simultaneously driven and damped towards zero.
Interestingly, the stationary distribution of this process is a centered Gaussian with mean $$\frac{T}{2}$$, while from the forward walk we might expect it to have mean $$T$$.
I was surprised by this and made some sense of it by noting that, if we started with the stationary distribution of $$x_T$$ and applied many backwards steps, it'd contract to a narrower distribution.

### Conclusions

#### Footnotes

[^a]: This post was inspired by the movie *Tenet*.

[^b]: We might have let the possible steps be $$\{-1,1\}$$ instead of $$\{0,1\}$$. This yields a centered random walk but a slightly more complicated final expression, so we stick with $$\{0,1\}$$ for the math.

[^c]: In case you were wondering, yes, this question was inspired by the movie *Tenet*, which forces you to think about the dynamics of things from the point of view of an observer moving the other way through time.

[^d]: The theoretical distribution plotted in Figure 1 (right) is actually a Gaussian distribution obtained by expanding Equation $$\ref{eqn:p_forwards}$$ around its mean. This Gaussian is both easier to deal with mathematically and nicer to plot.

[^3]: The $$dt^{1/2}$$ scaling is necessary because we want the jump to have *variance* $$dt$$, because variances add, so the total variance of the process will grow like $$t$$. If the steps were instead $$\mathcal{O}(dt)$$, the total variance would grow like $$t dt \approx 0$$, and our walker wouldn't go anywhere.