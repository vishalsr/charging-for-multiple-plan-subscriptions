var stripe;
var allPlanIds;

var stripeElements = function(publicKey, plans) {
  stripe = Stripe(publicKey);
  allPlanIds = plans.map(plan => plan.id)
  var elements = stripe.elements();

  // Element styles
  var style = {
    base: {
      fontSize: '16px',
      color: '#32325d',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: 'rgba(0,0,0,0.4)'
      }
    }
  };

  var card = elements.create('card', { style: style });

  card.mount('#card-element');

  // Element focus ring
  card.on('focus', function() {
    var el = document.getElementById('card-element');
    el.classList.add('focused');
  });

  card.on('blur', function() {
    var el = document.getElementById('card-element');
    el.classList.remove('focused');
  });

  document.querySelector('#submit').addEventListener('click', function(evt) {
    evt.preventDefault();
    document.querySelector('#submit').disabled = true;
    // Initiate payment
    pay(stripe, card);
  });
};

var pay = function(stripe, card) {
  var cardholderEmail = document.querySelector('#email').value;
  stripe
    .createPaymentMethod('card', card, {
      billing_details: {
        email: cardholderEmail
      }
    })
    .then(function(result) {
      if (result.error) {
        document.querySelector('#submit').disabled = false;
        // The card was declined (i.e. insufficient funds, card has expired, etc)
        var errorMsg = document.querySelector('.sr-field-error');
        errorMsg.textContent = result.error.message;
        setTimeout(function() {
          errorMsg.textContent = '';
        }, 4000);
      } else {
        createCustomer(result.paymentMethod.id, cardholderEmail, allPlanIds /* TODO: replace with customer input */);
      }
    });
};

function createCustomer(paymentMethod, cardholderEmail, planIds) {
  return fetch('/create-customer', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: cardholderEmail,
      payment_method: paymentMethod,
      plan_ids: planIds
    })
  })
    .then(response => {
      return response.json();
    })
    .then(subscription => {
      handleSubscription(subscription);
    });
}

function handleSubscription(subscription) {
  if (
    subscription &&
    subscription.latest_invoice &&
    subscription.latest_invoice.payment_intent &&
    subscription.latest_invoice.payment_intent.status === 'requires_action'
  ) {
    stripe
      .handleCardPayment(
        subscription.latest_invoice.payment_intent.client_secret
      )
      .then(function(result) {
        confirmSubscription(subscription.id);
      });
  } else if (subscription) {
    confirmSubscription(subscription.id);
    orderComplete(subscription);
  } else {
    orderComplete(subscription);
  }
}

function confirmSubscription(subscriptionId) {
  return fetch('/subscription', {
    method: 'post',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      subscriptionId: subscriptionId
    })
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(subscription) {
      orderComplete(subscription);
    });
}

function boostrap() {
  return fetch('/bootstrap', {
    method: 'get',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(json) {
      json.plans.forEach(function(plan) {
        plan.selected = false;
        allPlans[plan.id] = plan;
      });

      // BEGIN TEST HOOK
      Object.keys(allPlans).forEach((id) => {
        var checkboxElt = document.createElement('input');
        checkboxElt.setAttribute('type', 'checkbox')
        checkboxElt.setAttribute('id', id);
        checkboxElt.addEventListener('click', function () {
          allPlans[`${id}`].selected = document.getElementById(`${id}`).checked
          updatePrice();
        });

        // var descriptionElt = document.createElement('div');
        // descriptionElt.innerHTML = `${id}`;

        var productElt = document.createElement('div');
        productElt.appendChild(checkboxElt);
        //productElt.appendChild(descriptionElt);
        productElt.innerHTML += `${id}<br>`

        document
          .getElementById('test-hook-please-ignore')
          .appendChild(productElt);
      });
      // END TEST HOOK

      stripeElements(json.publicKey);
    });
}

boostrap();

/* ------- Post-payment helpers ------- */

/* Shows a success / error message when the payment is complete */
var orderComplete = function(subscription) {
  var subscriptionJson = JSON.stringify(subscription, null, 2);
  document.querySelectorAll('.payment-view').forEach(function(view) {
    view.classList.add('hidden');
  });
  document.querySelectorAll('.completed-view').forEach(function(view) {
    view.classList.remove('hidden');
  });
  document.querySelector('.order-status').textContent = subscription.status;
  document.querySelector('pre').textContent = subscriptionJson;
};
