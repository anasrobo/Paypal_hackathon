# Integrate

**Last updated:** October 14, 2026

Copy for LLM

[View as Markdown](https://developer.paypal.com/v5/checkout/fx/integrate.md)

Copy / Export

Copy for LLM [View as Markdown](https://developer.paypal.com/v5/checkout/fx/integrate.md)

To integrate FXaaS:

1. [Obtain an exchange rate quote](https://developer.paypal.com/v5/checkout/fx/integrate#get-exchange-rate-quote): Use the currency exchange API to retrieve and lock an exchange rate for payment processing.
2. [Create order](https://developer.paypal.com/v5/checkout/fx/integrate#use-fxid-and-create-order): Include FXaaS parameters in your payment method's create order calls. This enables support for local currency payments through the Orders v2 API.
3. [Capture payment](https://developer.paypal.com/v5/checkout/fx/integrate#capture-payment): Include FXaaS parameters in the capture order calls.
4. [Handle market moving events](https://developer.paypal.com/v5/checkout/fx/integrate#special-case-handle-market-moving-events-force-majeure).
5. [Test the FXaaS set-up](https://developer.paypal.com/v5/checkout/fx/integrate#test-fxaas-set-up).

## [Before you integrate](https://developer.paypal.com/v5/checkout/fx/integrate\#before-you-integrate)

- [Verify your eligibility](https://developer.paypal.com/foreign-exchange-as-a-service#eligibility) to integrate FXaaS.
- Review your [FXaaS contract](https://developer.paypal.com/foreign-exchange-as-a-service#eligibility). As part of FXaaS onboarding, PayPal enables FXaaS for your account based on the contract. The contract specifies the rate expiration interval, PayPal's rate refresh time, PayPal FX fees, and other relevant terms. For more information about fees, see the [merchant fees page](https://www.paypal.com/business/paypal-business-fees#statement-13).
- Complete [all mandatory steps to get started](https://developer.paypal.com/v5/checkout/fx/get-started). Use the retrieved sandbox app credentials (client ID and Secret) in your code to [generate an access token](https://developer.paypal.com/api/rest/#3-get-access-token). The access token is a server-side token that helps with app authentication when the app accesses PayPal API resources.

## [End-to-end workflow](https://developer.paypal.com/v5/checkout/fx/integrate\#end-to-end-workflow)

![Subscribe,with,card](https://www.paypalobjects.com/ppdevdocs/FXaaS%20Integrate%20-%20Flow.png)

## [1\. Get exchange rate quote](https://developer.paypal.com/v5/checkout/fx/integrate\#1-get-exchange-rate-quote)

Use the [Currency exchange API](https://developer.paypal.com/api/pricing/v2) to retrieve and lock an exchange rate.

**Important:** Your FXaaS contract specifies the expiration time, which determines how long the locked exchange rate remains valid after PayPal updates (refreshes) its exchange rate. At the time of payment processing, PayPal applies the locked exchange rate if it is still within the validity period. If the rate is no longer valid, PayPal processes the transaction using the prevailing exchange rate at the time of processing.

To get an exchange rate quote, you can do one of the following:

- Place multiple API calls to [fetch product-specific quotes](https://developer.paypal.com/v5/checkout/fx/integrate#get-product-specific-quote).
- Place one API call to [retrieve the exchange rate](https://developer.paypal.com/v5/checkout/fx/integrate#get-exchange-rate-only) between a currency pair, which you can cache and apply to multiple products.

### [Get a product-specific quote](https://developer.paypal.com/v5/checkout/fx/integrate\#get-a-product-specific-quote)

To retrieve a product-specific quote, in server-side code, call the [Quote exchange rates API](https://developer.paypal.com/api/pricing/v2/quote-exchange-rates) (`/v2/pricing/quote-exchange-rates`) and include the following parameters in the request payload:

- `base_currency:` Primary holding currency of the account in which PayPal settles money.
- `quote_currency:` Buyer's local currency.
- `base_amount` (optional): Product price in base currency. If this parameter is omitted, PayPal returns only the exchange rate and does not calculate the `quote_amount`.
- `markup_percent` (optional): Markup percentage added to the base exchange rate to include a conversion fee or account for margin adjustments.

**Response:** When the quote is retrieved successfully, the server-side code receives a `200 OK` response. The response payload includes the following parameters:

- `fx_id:` Unique identifier that associates a quoted FX rate with an order.
- `quote_amount.value:` Product price in the buyer's local currency.
- `exchange_rate:` Conversion rate between the base and quote currencies.
- `expiry_time:` UTC timestamp that specifies the validity period of the quoted FX rate.
- `rate_refresh_time:` Fixed daily UTC timestamp that specifies when PayPal updates its exchange rates.

**Important:**

- The retrieved exchange rates are valid for settlement until `rate_refresh_time`. `expiry_time` allows for an additional grace period to guarantee the rate even after `rate_refresh_time`.
- The time difference between `rate_refresh_time` and `expiry_time` (cut-off period) is set to three hours as a standard. When finalizing the FXaaS contract, you can request a different cut-off period. The request is reviewed and processed on a case-by-case basis.

scroll leftscroll right

```
curl -v -X POST 'https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ACCESS-TOKEN' \
  -d '{
    "quote_items": [\
      {\
        "base_currency": "USD",\
        "quote_currency": "GBP",\
        "base_amount": 16.80,\
        "markup_percent": 1\
      }\
    ]
  }'
```

### [Get exchange rate only](https://developer.paypal.com/v5/checkout/fx/integrate\#get-exchange-rate-only)

To retrieve the exchange rate between two currencies, in server-side code, call the [Quote exchange rates API](https://developer.paypal.com/api/pricing/v2/quote-exchange-rates) (`/v2/pricing/quote-exchange-rates`) and include only the following parameters in the request payload:

- `base_currency:` Primary holding currency of the account in which PayPal settles money.
- `quote_currency:` Buyer's local currency.

**Response:** When the quote is retrieved successfully, the server-side code receives a `200 OK` response. The response payload includes the following parameters:

- `exchange_rate:` Conversion rate between the base and quote currencies.
- `fx_id:` Unique identifier that links a quoted FX rate to an order.
- `expiry_time:` UTC timestamp that defines how long the quoted FX rate remains valid.
- `rate_refresh_time:` Fixed daily UTC timestamp that defines when PayPal refreshes its exchange rates.

**Important:** The retrieved exchange rate is valid for settlement until `rate_refresh_time`. `expiry_time` allows for an additional grace period to guarantee the rate even after `rate_refresh_time`. The time difference between `rate_refresh_time` and `expiry_time` (cut-off period) is set to three hours as a standard. When finalizing the FXaaS contract, you can request a different cut-off period. The request is reviewed and processed on a case-by-case basis.

scroll leftscroll right

```
curl -v -X POST 'https://api-m.sandbox.paypal.com/v2/pricing/quote-exchange-rates' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ACCESS-TOKEN' \
  -d '{
    "quote_items": [\
      {\
        "base_currency": "USD",\
        "quote_currency": "GBP"\
      }\
    ]
  }'
```

#### [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate\#proceed-as-follows)

- Save `exchange_rate_quotes[].fx_id` and `exchange_rate_quotes[].quote_amount{}`.
- If you only retrieved the exchange rate, use `exchange_rate_quotes[].quote_amount.value` to calculate product prices in the local currency.
- After authenticating the buyer, show the product prices in the local currency.
- Upon checkout, call the Orders v2 API using the stored `fx_id` as `payment_instruction.payee_receivable_fx_rate_id`.

## [2\. Use fx\_id and create order](https://developer.paypal.com/v5/checkout/fx/integrate\#2-use-fx_id-and-create-order)

When a buyer completes a purchase, use the [Orders v2 API](https://developer.paypal.com/api/orders/v2) to initiate payment processing and create an order in the PayPal system. In server-side code, call the [Create order](https://developer.paypal.com/api/orders/v2/orders-create) API (`v2/checkout/orders`) and include the following parameter in the request payload to associate the order with the locked exchange rate:

`payment_instruction.payee_receivable_fx_rate_id:` Set the value to the `fx_id` obtained as part of the exchange rate quote.

**Important:** The locked exchange rate is valid for settlement until `rate_refresh_time`. `expiry_time` allows for an additional grace period to guarantee the rate even after `rate_refresh_time`. If the Create order request does not include the `payment_instruction.payee_receivable_fx_rate_id` parameter, during payment capture, PayPal does not consider the additional `expiry_time`. PayPal validates whether the `rate_refresh_time` window is valid. If not, PayPal processes the transaction using the prevailing exchange rate at the time of the transaction.

**Response:** When the order is created successfully, the server-side code receives a `200 OK` response. The response payload includes the following parameters:

- `payee_receivable_fx_rate_id:` Identifier for the quoted FX rate that PayPal associates with the order and applies during capture if the exchange rate is still valid.
- `id:` Unique identifier that PayPal assigns to the created order.
- `links[].href` (with `rel: approve`): URL for payment approval.

scroll leftscroll right

```
curl -v -X POST https://api-m.sandbox.paypal.com/v2/checkout/orders \
-H "Content-Type: application/json" \
-H "Authorization: Bearer ACCESS-TOKEN" \
-d '{
  "intent": "CAPTURE",
  "purchase_units": [\
    {\
      "amount": {\
        "currency_code": "GBP",\
        "value": "13.60"\
      },\
      "payment_instruction": {\
        "payee_receivable_fx_rate_id": "MTFFQy05RjBFLTEyOTlDQTgwLTg3MzMtMzk0ODIwRUEwMTc4"\
      }\
    }\
  ]
}'
```

#### [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate\#proceed-as-follows-1)

- Save the `id` returned in the response. This identifier is required to capture the payment after buyer approval.
- Send the buyer to the approval URL to review and approve the payment.
- After the buyer approves the payment, call the Orders v2 > [Capture payment for an order](https://developer.paypal.com/api/orders/v2/orders-capture) API.

## [3\. Capture payment](https://developer.paypal.com/v5/checkout/fx/integrate\#3-capture-payment)

When a buyer approves the payment for the purchase, use the [Orders v2 API](https://developer.paypal.com/api/orders/v2) to finalize the payment and move money from the buyer to PayPal. In server-side code, call the [Capture payment for an order](https://developer.paypal.com/api/orders/v2/orders-capture) API (`v2/checkout/orders/:id/capture`). In the request payload, include the `id` retrieved as part of the create order response as a path parameter. PayPal identifies the order and its associated `fx_id` using the path parameter. PayPal determines the locked exchange rate based on the `fx_id`. If the exchange rate is valid, PayPal captures money from the buyer account using the locked exchange rate.

**Important:**

- Capture the completed payment within the FX quote validity window (`expiry_time`) to ensure the locked rate is applied.
- If the Create order request does not include the `payment_instruction.payee_receivable_fx_rate_id` parameter, during payment capture, PayPal does not consider the additional `expiry_time`. PayPal validates whether the `rate_refresh_time` window is valid. If not, PayPal processes the transaction using the prevailing exchange rate at the time of the transaction.
- PayPal transaction fee is charged in the buyer (payment) currency.

**Response:** When the order is created successfully, the server-side code receives a `200 OK` response. The response payload includes the following parameters:

- `payments.captures[].seller_receivable_breakdown.receivable_amount:` Final amount the merchant receives in their base currency.
- `payments.captures[].seller_receivable_breakdown.exchange_rate:` Exchange rate PayPal applies to convert the quote currency to your base currency.
- `payments.captures[].seller_receivable_breakdown.paypal_fee:` PayPal's transaction fee specified in terms of the quote currency.
- `payments.captures[].id:` Unique identifier for the captured payment.

scroll leftscroll right

```
curl -v -X POST https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T/capture \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS-TOKEN" \
  -H "PayPal-Request-Id: 7b92603e-77ed-4896-8e78-5dea2050476a"
```

#### [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate\#proceed-as-follows-2)

Save `payments.captures[].id` and `payments.captures[].seller_receivable_breakdown.receivable_amount` for back-end reporting and reconciliation.

## [4\. \[Special case\] Handle market-moving events (Force majeure)](https://developer.paypal.com/v5/checkout/fx/integrate\#4-special-case-handle-market-moving-events-force-majeure)

Market-moving events, such as natural disasters or political unrest, can lead to high volatility in currency markets and the FXaaS exchange rate lock guarantee may be suspended. In response to these events, PayPal updates the exchange rates and issues a new `fx_id` outside the regular refresh cycle.

If such an event occurs after you retrieve an exchange rate quote and before you create an order, the Create an order API call returns a `422 UNPROCESSABLE_ENTITY` response to the server-side code with the following response parameters:

- `issue:` Value set to `FX_RATE_CHANGE_DUE_TO_MARKET_EVENT` indicating that a market-moving event has caused the locked exchange rate to change.
- `links[].href` with `rel: new_fx_id`: URL to fetch the updated exchange rate quote.

scroll leftscroll right

```
curl -v -X POST https://api-m.sandbox.paypal.com/v2/checkout/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS-TOKEN" \
  -d '{
    "intent": "CAPTURE",
    "purchase_units": [\
      {\
        "amount": {\
          "currency_code": "GBP",\
          "value": "13.60"\
        },\
        "payment_instruction": {\
          "payee_receivable_fx_rate_id": "MTFFQy05RjBFLTEyOTlDQTgwLTg3MzMtMzk0ODIwRUEwMTc4"\
        }\
      }\
    ]
  }'
```

#### [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate\#proceed-as-follows-3)

- To retrieve the new exchange rate quote, place a `GET` call to the `links[].href` URL (the URL with `links[].rel` set as `new_fx_id`).
- Display the new product prices to buyers.
- Upon checkout, call the Orders v2 API using the new `fx_id` as `payment_instruction.payee_receivable_fx_rate_id`.

**Important:** After the API call that returns the `HTTP 422` response code, any further Create an order API call with the old `fx_id` returns a `200 OK` response with `payee_receivable_fx_rate_id` set to the new `fx_id`. This indicates that during payment capture, PayPal processes payments based on the new updated exchange rate (associated with the new `fx_id`).

## [5\. Test FXaaS set-up](https://developer.paypal.com/v5/checkout/fx/integrate\#5-test-fxaas-set-up)

Before going live, use your sandbox environment to thoroughly test FXaaS integration. This includes verifying the exchange rates retrieval logic, order creation logic, payment capture logic, and error handling.

After testing, [Move your app to production](https://developer.paypal.com/api/rest/production/).

[Get started\\
\\
Previous Page](https://developer.paypal.com/v5/checkout/fx/get-started) [FX currency codes\\
\\
Next Page](https://developer.paypal.com/v5/checkout/fx/currency-codes)

[**On this page**](https://developer.paypal.com/v5/checkout/fx/integrate#)

### On this page

[Before you integrate](https://developer.paypal.com/v5/checkout/fx/integrate#before-you-integrate) [End-to-end workflow](https://developer.paypal.com/v5/checkout/fx/integrate#end-to-end-workflow) [1\. Get exchange rate quote](https://developer.paypal.com/v5/checkout/fx/integrate#1-get-exchange-rate-quote) [Get a product-specific quote](https://developer.paypal.com/v5/checkout/fx/integrate#get-a-product-specific-quote) [Get exchange rate only](https://developer.paypal.com/v5/checkout/fx/integrate#get-exchange-rate-only) [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate#proceed-as-follows) [2\. Use fx\_id and create order](https://developer.paypal.com/v5/checkout/fx/integrate#2-use-fx_id-and-create-order) [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate#proceed-as-follows-1) [3\. Capture payment](https://developer.paypal.com/v5/checkout/fx/integrate#3-capture-payment) [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate#proceed-as-follows-2) [4\. \[Special case\] Handle market-moving events (Force majeure)](https://developer.paypal.com/v5/checkout/fx/integrate#4-special-case-handle-market-moving-events-force-majeure) [Proceed as follows](https://developer.paypal.com/v5/checkout/fx/integrate#proceed-as-follows-3) [5\. Test FXaaS set-up](https://developer.paypal.com/v5/checkout/fx/integrate#5-test-fxaas-set-up)

#### If you accept cookies, we’ll use them to improve and customize your experience and enable our partners to show you personalized PayPal ads when you visit other sites. [Manage cookies and learn more](https://www.paypal.com/myaccount/privacy/cookiePrefs?locale=en_US)

AcceptDecline

Close