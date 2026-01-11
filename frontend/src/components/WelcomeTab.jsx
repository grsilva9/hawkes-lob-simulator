import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import './WelcomeTab.css';

const WelcomeTab = ({ onNavigateToSimulator }) => {
  return (
    <div className="welcome-tab">
      {/* Hero Section - Outside Grid */}
      <section className="hero-section">
        <h1 className="hero-title">Hawkes LOB Simulator</h1>
        <p className="hero-subtitle">
          A Limit Order Book simulator driven by multivariate Hawkes processes
        </p>
      </section>

      {/* Main Content - Poster Grid */}
      <div className="welcome-content">
        {/* Introduction */}
        <section className="intro-section">
          <h2>What is this?</h2>
          <p>
            This tool simulates a <strong>Limit Order Book (LOB)</strong> — the core mechanism 
            of modern financial exchanges. Order arrivals are modeled using a 
            <strong> multivariate Hawkes process</strong>, which captures a key empirical fact: 
            market events tend to cluster in time. A buy order often triggers more activity, 
            creating bursts of trading.
          </p>
        </section>

        {/* The Model */}
        <section className="model-section">
          <h2>The Model</h2>
          <p>
            The intensity (instantaneous arrival rate) of event type <InlineMath math="i" /> at time <InlineMath math="t" /> is:
          </p>
          
          <div className="equation-block">
            <BlockMath math="\lambda_i(t) = \mu_i + \sum_{j=1}^{D} \sum_{t_k^j < t} \alpha_{ij} \, e^{-\beta_{ij}(t - t_k^j)}" />
          </div>

          <p className="equation-description">
            Where <InlineMath math="D = 6" /> event types represent order book activity, 
            and <InlineMath math="t_k^j" /> denotes the time of the <InlineMath math="k" />-th event of type <InlineMath math="j" />.
          </p>
        </section>

        {/* Event Types */}
        <section className="events-section">
          <h2>Event Types</h2>
          <p>The simulator models six core order book events:</p>
          
          <div className="event-grid">
            <div className="event-card event-market">
              <div className="event-pair">
                <div className="event-item">
                  <span className="event-code">MB</span>
                  <span className="event-name">Market Buy</span>
                </div>
                <div className="event-item">
                  <span className="event-code">MS</span>
                  <span className="event-name">Market Sell</span>
                </div>
              </div>
              <p className="event-desc">Aggressive orders that execute immediately, consuming liquidity</p>
            </div>
            
            <div className="event-card event-limit">
              <div className="event-pair">
                <div className="event-item">
                  <span className="event-code">LB</span>
                  <span className="event-name">Limit Buy</span>
                </div>
                <div className="event-item">
                  <span className="event-code">LS</span>
                  <span className="event-name">Limit Sell</span>
                </div>
              </div>
              <p className="event-desc">Passive orders that add liquidity to the book</p>
            </div>
            
            <div className="event-card event-cancel">
              <div className="event-pair">
                <div className="event-item">
                  <span className="event-code">CB</span>
                  <span className="event-name">Cancel Buy</span>
                </div>
                <div className="event-item">
                  <span className="event-code">CS</span>
                  <span className="event-name">Cancel Sell</span>
                </div>
              </div>
              <p className="event-desc">Order cancellations that remove liquidity from the book</p>
            </div>
          </div>
        </section>

        {/* Parameters */}
        <section className="params-section">
          <h2>Parameters</h2>
          
          <div className="param-cards">
            {/* Mu */}
            <div className="param-card param-mu">
              <div className="param-header">
                <span className="param-symbol">μ</span>
                <span className="param-name">Base Intensity</span>
              </div>
              <div className="param-math">
                <InlineMath math="\mu_i > 0" />
              </div>
              <p className="param-desc">
                The baseline arrival rate for each event type. Higher <InlineMath math="\mu" /> means 
                more frequent events even without external triggers.
              </p>
              <div className="param-example">
                <span className="example-label">Example:</span>
                <span><InlineMath math="\mu_{MB} = 2.0" /> → ~2 market buys per unit time at baseline</span>
              </div>
            </div>

            {/* Alpha */}
            <div className="param-card param-alpha">
              <div className="param-header">
                <span className="param-symbol">α</span>
                <span className="param-name">Excitation Matrix</span>
              </div>
              <div className="param-math">
                <InlineMath math="\alpha_{ij} \geq 0" />
              </div>
              <p className="param-desc">
                How much event <InlineMath math="j" /> excites (increases the rate of) event <InlineMath math="i" />. 
                This creates the clustering effect — events trigger more events.
              </p>
              <div className="param-example">
                <span className="example-label">Example:</span>
                <span><InlineMath math="\alpha_{MS,MB} = 0.3" /> → Market buys trigger more market sells</span>
              </div>
            </div>

            {/* Beta */}
            <div className="param-card param-beta">
              <div className="param-header">
                <span className="param-symbol">β</span>
                <span className="param-name">Decay Rate</span>
              </div>
              <div className="param-math">
                <InlineMath math="\beta_{ij} > 0" />
              </div>
              <p className="param-desc">
                How quickly the excitation effect decays. Higher <InlineMath math="\beta" /> means 
                the influence fades faster; lower values create longer-lasting impact.
              </p>
              <div className="param-example">
                <span className="example-label">Example:</span>
                <span><InlineMath math="\beta = 1.5" /> → excitation halves in ~0.46 time units</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stability Note */}
        <section className="stability-section">
          <h2>Stability Condition</h2>
          <p>
            For the process to be stationary (not explode), the spectral radius of the 
            branching matrix must be less than 1:
          </p>
          <div className="equation-block equation-small">
            <BlockMath math="\rho\left( \frac{\alpha_{ij}}{\beta_{ij}} \right) < 1" />
          </div>
          <p className="note">
            In practice, keep excitation values moderate relative to decay rates. 
            The preset regimes are all stable configurations.
          </p>
        </section>


      </div>
    </div>
  );
};

export default WelcomeTab;