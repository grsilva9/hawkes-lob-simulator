"""
Pre-built strategy templates
Users can start from these and customize
"""

STRATEGY_TEMPLATES = {
    'sma_mean_reversion': {
        'name': 'SMA Mean Reversion',
        'description': 'Buy when price drops below moving average, sell when above',
        'category': 'Mean Reversion',
        'difficulty': 'Beginner',
        'functions': [
            {
                'id': 'sma_ratio',
                'name': 'Price/SMA Ratio',
                'expression': 'mid / SMA(mid, 50)',
                'description': 'Current price divided by 50-period moving average'
            }
        ],
        'entry_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'sma_ratio',
                        'operator': '<',
                        'threshold': 0.998
                    }
                ],
                'logic': 'AND',
                'action': 'BUY'
            },
            {
                'conditions': [
                    {
                        'function_id': 'sma_ratio',
                        'operator': '>',
                        'threshold': 1.002
                    }
                ],
                'logic': 'AND',
                'action': 'SELL'
            }
        ],
        'exit_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'sma_ratio',
                        'operator': '>=',
                        'threshold': 0.9995
                    },
                    {
                        'function_id': 'sma_ratio',
                        'operator': '<=',
                        'threshold': 1.0005
                    }
                ],
                'logic': 'AND',
                'action': 'FLAT'
            }
        ]
    },
    
    'bollinger_bands': {
        'name': 'Bollinger Band Breakout',
        'description': 'Trade when price breaks out of Bollinger Bands',
        'category': 'Volatility',
        'difficulty': 'Intermediate',
        'functions': [
            {
                'id': 'upper_band',
                'name': 'Upper Bollinger Band',
                'expression': 'SMA(mid, 20) + 2 * STD(mid, 20)',
                'description': 'Upper band: SMA + 2 standard deviations'
            },
            {
                'id': 'lower_band',
                'name': 'Lower Bollinger Band',
                'expression': 'SMA(mid, 20) - 2 * STD(mid, 20)',
                'description': 'Lower band: SMA - 2 standard deviations'
            },
            {
                'id': 'bb_position',
                'name': 'BB Position',
                'expression': '(mid - (SMA(mid, 20) - 2 * STD(mid, 20))) / (4 * STD(mid, 20))',
                'description': 'Position within bands (0=lower, 0.5=middle, 1=upper)'
            }
        ],
        'entry_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'bb_position',
                        'operator': '<',
                        'threshold': 0.1
                    }
                ],
                'logic': 'AND',
                'action': 'BUY'
            },
            {
                'conditions': [
                    {
                        'function_id': 'bb_position',
                        'operator': '>',
                        'threshold': 0.9
                    }
                ],
                'logic': 'AND',
                'action': 'SELL'
            }
        ],
        'exit_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'bb_position',
                        'operator': '>=',
                        'threshold': 0.45
                    },
                    {
                        'function_id': 'bb_position',
                        'operator': '<=',
                        'threshold': 0.55
                    }
                ],
                'logic': 'AND',
                'action': 'FLAT'
            }
        ]
    },
    
    'momentum_trend': {
        'name': 'Momentum Trend Following',
        'description': 'Follow strong momentum trends',
        'category': 'Momentum',
        'difficulty': 'Beginner',
        'functions': [
            {
                'id': 'momentum_short',
                'name': 'Short-term Momentum',
                'expression': 'MOMENTUM(mid, 10)',
                'description': '10-period momentum'
            },
            {
                'id': 'momentum_long',
                'name': 'Long-term Momentum',
                'expression': 'MOMENTUM(mid, 30)',
                'description': '30-period momentum'
            }
        ],
        'entry_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'momentum_short',
                        'operator': '>',
                        'threshold': 0.001
                    },
                    {
                        'function_id': 'momentum_long',
                        'operator': '>',
                        'threshold': 0.0005
                    }
                ],
                'logic': 'AND',
                'action': 'BUY'
            },
            {
                'conditions': [
                    {
                        'function_id': 'momentum_short',
                        'operator': '<',
                        'threshold': -0.001
                    },
                    {
                        'function_id': 'momentum_long',
                        'operator': '<',
                        'threshold': -0.0005
                    }
                ],
                'logic': 'AND',
                'action': 'SELL'
            }
        ],
        'exit_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'momentum_short',
                        'operator': '>=',
                        'threshold': -0.0002
                    },
                    {
                        'function_id': 'momentum_short',
                        'operator': '<=',
                        'threshold': 0.0002
                    }
                ],
                'logic': 'AND',
                'action': 'FLAT'
            }
        ]
    },
    
    'spread_aware_mr': {
        'name': 'Spread-Aware Mean Reversion',
        'description': 'Mean reversion that only trades when spread is tight',
        'category': 'Mean Reversion',
        'difficulty': 'Intermediate',
        'functions': [
            {
                'id': 'price_deviation',
                'name': 'Price Deviation',
                'expression': '(mid - SMA(mid, 40)) / SMA(mid, 40)',
                'description': 'Percentage deviation from 40-period SMA'
            },
            {
                'id': 'spread_quality',
                'name': 'Spread Quality',
                'expression': 'spread / SMA(spread, 20)',
                'description': 'Current spread relative to average'
            }
        ],
        'entry_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'price_deviation',
                        'operator': '<',
                        'threshold': -0.0003
                    },
                    {
                        'function_id': 'spread_quality',
                        'operator': '<',
                        'threshold': 0.8
                    }
                ],
                'logic': 'AND',
                'action': 'BUY'
            },
            {
                'conditions': [
                    {
                        'function_id': 'price_deviation',
                        'operator': '>',
                        'threshold': 0.0003
                    },
                    {
                        'function_id': 'spread_quality',
                        'operator': '<',
                        'threshold': 0.8
                    }
                ],
                'logic': 'AND',
                'action': 'SELL'
            }
        ],
        'exit_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'price_deviation',
                        'operator': '>=',
                        'threshold': -0.0001
                    },
                    {
                        'function_id': 'price_deviation',
                        'operator': '<=',
                        'threshold': 0.0001
                    }
                ],
                'logic': 'AND',
                'action': 'FLAT'
            },
            {
                'conditions': [
                    {
                        'function_id': 'spread_quality',
                        'operator': '>',
                        'threshold': 2.0
                    }
                ],
                'logic': 'AND',
                'action': 'FLAT'
            }
        ]
    },
    
    'ema_crossover': {
        'name': 'EMA Crossover',
        'description': 'Trade on exponential moving average crossovers',
        'category': 'Trend Following',
        'difficulty': 'Beginner',
        'functions': [
            {
                'id': 'ema_fast',
                'name': 'Fast EMA',
                'expression': 'EMA(mid, 12)',
                'description': '12-period exponential moving average'
            },
            {
                'id': 'ema_slow',
                'name': 'Slow EMA',
                'expression': 'EMA(mid, 26)',
                'description': '26-period exponential moving average'
            },
            {
                'id': 'ema_ratio',
                'name': 'EMA Ratio',
                'expression': 'EMA(mid, 12) / EMA(mid, 26)',
                'description': 'Fast EMA divided by slow EMA'
            }
        ],
        'entry_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'ema_ratio',
                        'operator': '>',
                        'threshold': 1.0005
                    }
                ],
                'logic': 'AND',
                'action': 'BUY'
            },
            {
                'conditions': [
                    {
                        'function_id': 'ema_ratio',
                        'operator': '<',
                        'threshold': 0.9995
                    }
                ],
                'logic': 'AND',
                'action': 'SELL'
            }
        ],
        'exit_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'ema_ratio',
                        'operator': '>=',
                        'threshold': 0.9998
                    },
                    {
                        'function_id': 'ema_ratio',
                        'operator': '<=',
                        'threshold': 1.0002
                    }
                ],
                'logic': 'AND',
                'action': 'FLAT'
            }
        ]
    },
    
    'volatility_breakout': {
        'name': 'Volatility Breakout',
        'description': 'Trade breakouts from low volatility periods',
        'category': 'Volatility',
        'difficulty': 'Advanced',
        'functions': [
            {
                'id': 'volatility',
                'name': 'Price Volatility',
                'expression': 'STD(mid, 30)',
                'description': '30-period standard deviation of price'
            },
            {
                'id': 'vol_percentile',
                'name': 'Volatility Percentile',
                'expression': '(STD(mid, 30) - MIN(STD(mid, 30), 50)) / (MAX(STD(mid, 30), 50) - MIN(STD(mid, 30), 50))',
                'description': 'Current volatility relative to recent range'
            },
            {
                'id': 'price_momentum',
                'name': 'Price Momentum',
                'expression': 'MOMENTUM(mid, 5)',
                'description': 'Short-term price momentum'
            }
        ],
        'entry_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'vol_percentile',
                        'operator': '<',
                        'threshold': 0.3
                    },
                    {
                        'function_id': 'price_momentum',
                        'operator': '>',
                        'threshold': 0.0005
                    }
                ],
                'logic': 'AND',
                'action': 'BUY'
            },
            {
                'conditions': [
                    {
                        'function_id': 'vol_percentile',
                        'operator': '<',
                        'threshold': 0.3
                    },
                    {
                        'function_id': 'price_momentum',
                        'operator': '<',
                        'threshold': -0.0005
                    }
                ],
                'logic': 'AND',
                'action': 'SELL'
            }
        ],
        'exit_rules': [
            {
                'conditions': [
                    {
                        'function_id': 'vol_percentile',
                        'operator': '>',
                        'threshold': 0.7
                    }
                ],
                'logic': 'AND',
                'action': 'FLAT'
            }
        ]
    }
}


def get_template(template_id):
    """Get a strategy template by ID"""
    return STRATEGY_TEMPLATES.get(template_id)


def get_all_templates():
    """Get all strategy templates"""
    return STRATEGY_TEMPLATES


def get_templates_by_category():
    """Get templates organized by category"""
    categories = {}
    for template_id, template in STRATEGY_TEMPLATES.items():
        category = template.get('category', 'Other')
        if category not in categories:
            categories[category] = []
        categories[category].append({
            'id': template_id,
            'name': template['name'],
            'description': template['description'],
            'difficulty': template.get('difficulty', 'Intermediate')
        })
    return categories


def get_template_summary():
    """Get a summary of all templates for UI display"""
    return [
        {
            'id': template_id,
            'name': template['name'],
            'description': template['description'],
            'category': template.get('category', 'Other'),
            'difficulty': template.get('difficulty', 'Intermediate'),
            'num_functions': len(template['functions']),
            'num_entry_rules': len(template['entry_rules']),
            'num_exit_rules': len(template['exit_rules'])
        }
        for template_id, template in STRATEGY_TEMPLATES.items()
    ]