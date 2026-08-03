import sys
import click

from notes_ai.agent import run_agent


@click.group(invoke_without_command=True)
@click.version_option(version="1.0.0", prog_name="notes-ai")
@click.pass_context
def cli(ctx):
    """Video Notes AI - Turn any social media video URL into structured notes.

    Paste a YouTube, Twitter/X, Reddit, Vimeo, Instagram, or any other
    video URL and get AI-generated structured notes from the content.
    """
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@cli.command()
@click.argument("url")
@click.option("--no-save", is_flag=True, help="Don't save output to disk")
def process(url, no_save):
    """Process a video URL and generate structured notes."""
    click.echo()
    click.echo(click.style(" Video Notes Agent ", fg="magenta", bold=True))
    click.echo(click.style(" " + "=" * 38, fg="magenta"))
    click.echo(f"  URL: {click.style(url, fg='cyan')}")
    click.echo()

    if no_save:
        click.echo("  Note: output will not be saved to disk or memory")
        click.echo()

    result = run_agent(url, save=not no_save)

    click.echo()
    if result.startswith("[ERROR]"):
        click.echo(click.style(f"  Error: {result[7:]}", fg="red"))
        sys.exit(1)
    else:
        click.echo(result)


@cli.command()
def browse():
    """Browse previously saved outputs interactively."""
    from notes_ai.browse import browse_outputs
    browse_outputs()


@cli.command()
def list():
    """List all saved outputs."""
    from notes_ai.browse import list_outputs
    list_outputs()


@cli.command()
@click.option("--port", default=8081, help="Port to run the server on", show_default=True)
def serve(port):
    """Start the web UI server (accessible from any device on the network).

    Open the shown URL on your phone or another device to paste
    video URLs and get notes from a mobile-friendly interface.
    """
    from notes_ai.web import run_server
    from notes_ai.web import PORT as DEFAULT_PORT

    if port != DEFAULT_PORT:
        import notes_ai.web
        notes_ai.web.PORT = port

    run_server()


if __name__ == "__main__":
    cli()
