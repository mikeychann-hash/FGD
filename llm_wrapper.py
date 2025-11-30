import sys
import subprocess
import argparse
import os
import json

CONFIG_FILE = 'cli_config.json'

def load_config():
    """Load configuration from JSON file."""
    if not os.path.exists(CONFIG_FILE):
        return None
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load config file: {e}", file=sys.stderr)
        return None

def run_cli_command(provider, prompt, model=None):
    """
    Executes the CLI command defined in cli_config.json or defaults to system command.
    """
    config = load_config()
    provider_config = config.get('providers', {}).get(provider, {}) if config else {}
    
    # Determine command to run
    # If config exists, use 'command' from config, otherwise default to provider name
    base_cmd = provider_config.get('command', provider)
    
    # Check if enabled
    if config and not provider_config.get('enabled', True):
        return f"Error: Provider '{provider}' is disabled in configuration."

    cmd = [base_cmd]
    
    # Add configured arguments if any
    if provider_config.get('args'):
        cmd.extend(provider_config['args'])
    
    # Appending the prompt. 
    # NOTE: Different CLIs handle prompts differently. 
    # Some might expect a flag like --prompt "text", others just "text".
    # We'll append the prompt as the last argument by default.
    cmd.append(prompt)
    
    # Handle model flag if provided and not hardcoded in args
    if model:
        # Check if model is already in args to avoid duplication if user configured it there
        if '--model' not in cmd:
             cmd.extend(['--model', model])

    try:
        # Run the command
        # cwd=os.getcwd() ensures we run where the config likely is (root)
        process = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            encoding='utf-8',
            cwd=os.getcwd()
        )
        
        if process.returncode != 0:
            return f"Error executing {provider}: {process.stderr.strip()}"
            
        return process.stdout.strip()
        
    except FileNotFoundError:
        return f"Error: Command '{base_cmd}' not found. Please ensure it is installed or configured correctly in {CONFIG_FILE}."
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    parser = argparse.ArgumentParser(description='LLM CLI Wrapper')
    parser.add_argument('--provider', required=True, help='The LLM provider key (codex, gemini, claude, etc.)')
    parser.add_argument('--prompt', required=True, help='The prompt to send')
    parser.add_argument('--model', help='Optional model name override')
    
    args = parser.parse_args()
    
    result = run_cli_command(args.provider, args.prompt, args.model)
    print(result)

if __name__ == "__main__":
    main()
