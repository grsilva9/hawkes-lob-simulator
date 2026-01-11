"""
Strategy validation utilities
Validates strategy definitions before execution
"""

from lob_simulator.expression_evaluator import validate_expression


def validate_strategy_definition(strategy_config):
    """
    Validate a strategy configuration before running backtest
    
    Args:
        strategy_config: dict with structure:
            {
                'name': str,
                'functions': [{id, name, expression}, ...],
                'entry_rules': [{conditions, logic, action}, ...],
                'exit_rules': [{conditions, logic, action}, ...]
            }
    
    Returns:
        (is_valid: bool, errors: list, warnings: list)
    """
    errors = []
    warnings = []
    
    # 1. Validate basic structure
    if not isinstance(strategy_config, dict):
        errors.append("Strategy config must be a dictionary")
        return False, errors, warnings
    
    name = strategy_config.get('name', '')
    if not name or not name.strip():
        warnings.append("Strategy has no name")
    
    # 2. Validate functions
    functions = strategy_config.get('functions', [])
    if not functions:
        errors.append("Strategy must define at least one function")
    
    function_ids = set()
    for i, func in enumerate(functions):
        func_id = func.get('id')
        func_name = func.get('name', f'Function {i+1}')
        expression = func.get('expression')
        
        # Check function has required fields
        if not func_id:
            errors.append(f"Function '{func_name}' missing 'id' field")
            continue
        
        if func_id in function_ids:
            errors.append(f"Duplicate function id: '{func_id}'")
        function_ids.add(func_id)
        
        if not expression:
            errors.append(f"Function '{func_name}' missing 'expression' field")
            continue
        
        # Validate expression
        is_valid, error, suggestion = validate_expression(expression)
        if not is_valid:
            errors.append(f"Function '{func_name}': {error}")
            if suggestion:
                warnings.append(f"Function '{func_name}': {suggestion}")
    
    # 3. Validate entry rules
    entry_rules = strategy_config.get('entry_rules', [])
    if not entry_rules:
        warnings.append("Strategy has no entry rules - will never enter positions")
    
    for i, rule in enumerate(entry_rules):
        rule_errors = _validate_rule(rule, function_ids, f"Entry rule {i+1}")
        errors.extend(rule_errors)
    
    # 4. Validate exit rules
    exit_rules = strategy_config.get('exit_rules', [])
    if not exit_rules:
        warnings.append("Strategy has no exit rules - positions may not close properly")
    
    for i, rule in enumerate(exit_rules):
        rule_errors = _validate_rule(rule, function_ids, f"Exit rule {i+1}")
        errors.extend(rule_errors)
    
    # 5. Check for logical issues
    if entry_rules and exit_rules:
        # Check if entry and exit rules could conflict
        entry_actions = {rule.get('action') for rule in entry_rules}
        exit_actions = {rule.get('action') for rule in exit_rules}
        
        if 'FLAT' in entry_actions:
            warnings.append("Entry rule with action 'FLAT' is unusual")
        
        if 'BUY' in exit_actions or 'SELL' in exit_actions:
            warnings.append("Exit rule with 'BUY' or 'SELL' action is unusual - consider using 'FLAT'")
    
    is_valid = len(errors) == 0
    return is_valid, errors, warnings


def _validate_rule(rule, valid_function_ids, rule_name):
    """
    Validate a single rule
    Returns list of error messages
    """
    errors = []
    
    if not isinstance(rule, dict):
        errors.append(f"{rule_name}: must be a dictionary")
        return errors
    
    # Check conditions
    conditions = rule.get('conditions', [])
    if not conditions:
        errors.append(f"{rule_name}: must have at least one condition")
    
    for i, condition in enumerate(conditions):
        if not isinstance(condition, dict):
            errors.append(f"{rule_name}, condition {i+1}: must be a dictionary")
            continue
        
        func_id = condition.get('function_id')
        if not func_id:
            errors.append(f"{rule_name}, condition {i+1}: missing 'function_id'")
        elif func_id not in valid_function_ids:
            errors.append(f"{rule_name}, condition {i+1}: references unknown function '{func_id}'")
        
        operator = condition.get('operator')
        valid_operators = ['>', '<', '>=', '<=', '==', '!=']
        if not operator:
            errors.append(f"{rule_name}, condition {i+1}: missing 'operator'")
        elif operator not in valid_operators:
            errors.append(f"{rule_name}, condition {i+1}: invalid operator '{operator}'. Must be one of: {', '.join(valid_operators)}")
        
        threshold = condition.get('threshold')
        if threshold is None:
            errors.append(f"{rule_name}, condition {i+1}: missing 'threshold'")
        elif not isinstance(threshold, (int, float)):
            errors.append(f"{rule_name}, condition {i+1}: threshold must be a number")
    
    # Check logic
    logic = rule.get('logic', 'AND')
    if logic not in ['AND', 'OR']:
        errors.append(f"{rule_name}: logic must be 'AND' or 'OR', got '{logic}'")
    
    # Check action
    action = rule.get('action')
    valid_actions = ['BUY', 'SELL', 'FLAT', 'HOLD']
    if not action:
        errors.append(f"{rule_name}: missing 'action'")
    elif action not in valid_actions:
        errors.append(f"{rule_name}: invalid action '{action}'. Must be one of: {', '.join(valid_actions)}")
    
    return errors


def estimate_strategy_requirements(strategy_config):
    """
    Estimate strategy requirements (minimum data points, etc.)
    
    Returns:
        {
            'min_data_points': int,
            'variables_used': [str],
            'max_window': int
        }
    """
    import re
    
    functions = strategy_config.get('functions', [])
    
    max_window = 0
    variables_used = set()
    
    for func in functions:
        expression = func.get('expression', '')
        
        # Extract variables (mid, spread, etc.)
        for var in ['mid', 'spread', 'best_bid', 'best_ask', 'volume', 'returns']:
            if var in expression:
                variables_used.add(var)
        
        # Extract window sizes from function calls like SMA(mid, 50)
        # Pattern: FUNCTION_NAME(arg, WINDOW)
        window_pattern = r'\b(?:SMA|EMA|STD|MIN|MAX|MOMENTUM)\s*\(\s*\w+\s*,\s*(\d+)\s*\)'
        matches = re.findall(window_pattern, expression)
        
        for match in matches:
            window = int(match)
            max_window = max(max_window, window)
    
    return {
        'min_data_points': max_window + 10,  # Add buffer
        'variables_used': list(variables_used),
        'max_window': max_window
    }


def get_strategy_summary(strategy_config):
    """
    Generate human-readable summary of strategy
    """
    name = strategy_config.get('name', 'Unnamed Strategy')
    functions = strategy_config.get('functions', [])
    entry_rules = strategy_config.get('entry_rules', [])
    exit_rules = strategy_config.get('exit_rules', [])
    
    requirements = estimate_strategy_requirements(strategy_config)
    
    summary = {
        'name': name,
        'num_functions': len(functions),
        'num_entry_rules': len(entry_rules),
        'num_exit_rules': len(exit_rules),
        'min_data_points': requirements['min_data_points'],
        'variables_used': requirements['variables_used'],
        'max_window': requirements['max_window'],
        'description': _generate_description(strategy_config)
    }
    
    return summary


def _generate_description(strategy_config):
    """
    Generate natural language description of strategy
    """
    functions = strategy_config.get('functions', [])
    entry_rules = strategy_config.get('entry_rules', [])
    exit_rules = strategy_config.get('exit_rules', [])
    
    desc_parts = []
    
    # Functions
    if functions:
        desc_parts.append(f"Uses {len(functions)} custom indicator(s)")
    
    # Entry logic
    buy_rules = [r for r in entry_rules if r.get('action') == 'BUY']
    sell_rules = [r for r in entry_rules if r.get('action') == 'SELL']
    
    if buy_rules:
        desc_parts.append(f"Enters long on {len(buy_rules)} condition(s)")
    if sell_rules:
        desc_parts.append(f"Enters short on {len(sell_rules)} condition(s)")
    
    # Exit logic
    if exit_rules:
        desc_parts.append(f"Exits on {len(exit_rules)} condition(s)")
    
    return ". ".join(desc_parts) + "."